"""
Progress service for handling user progress data.
Manages word progress, sessions, and trial data import.
"""
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.database import User, UserWord, Session as DBSession, SessionAnswer
from app.schemas import WordProgressBase, ProgressSyncData


class ProgressService:
    """Service for managing user progress data."""
    
    async def import_trial_progress(
        self, 
        db: Session, 
        user_id: str, 
        trial_data: Dict[str, Any]
    ) -> None:
        """
        Import anonymous trial data during user registration.
        
        Args:
            db: Database session
            user_id: User ID
            trial_data: Trial data from anonymous user
        """
        try:
            # Extract trial components
            words_data = trial_data.get("words", [])
            sessions_data = trial_data.get("sessions", [])
            stats_data = trial_data.get("stats", {})
            
            # Import word progress
            if words_data:
                await self._import_word_progress(db, user_id, words_data)
            
            # Import session data (optional - might be too much data)
            if sessions_data:
                await self._import_session_summaries(db, user_id, sessions_data)
            
            # Update user statistics
            if stats_data:
                await self._update_user_stats(db, user_id, stats_data)
                
        except Exception as e:
            raise Exception(f"Failed to import trial progress: {str(e)}")
    
    async def _import_word_progress(
        self, 
        db: Session, 
        user_id: str, 
        words_data: List[Dict[str, Any]]
    ) -> None:
        """Import word progress data."""
        word_objects = []
        
        for word_data in words_data:
            try:
                word_progress = UserWord(
                    user_id=user_id,
                    word_id=word_data.get("word_id", ""),
                    mastery_level=Decimal(str(word_data.get("mastery_level", 0.0))),
                    repetitions=word_data.get("repetitions", 0),
                    ease_factor=Decimal(str(word_data.get("ease_factor", 2.5))),
                    last_review=self._parse_date(word_data.get("last_review")),
                    next_review=self._parse_date(word_data.get("next_review")),
                    seen_count=word_data.get("seen_count", 0),
                    correct_count=word_data.get("correct_count", 0),
                )
                word_objects.append(word_progress)
                
            except Exception as e:
                # Log error but continue with other words
                print(f"Error importing word {word_data.get('word_id')}: {str(e)}")
                continue
        
        # Bulk insert word progress
        if word_objects:
            db.add_all(word_objects)
    
    async def _import_session_summaries(
        self, 
        db: Session, 
        user_id: str, 
        sessions_data: List[Dict[str, Any]]
    ) -> None:
        """Import session summary data (last few sessions only)."""
        # Only import last 5 sessions to avoid data overload
        recent_sessions = sessions_data[-5:] if len(sessions_data) > 5 else sessions_data
        
        session_objects = []
        for session_data in recent_sessions:
            try:
                session = DBSession(
                    user_id=user_id,
                    practice_type=session_data.get("practice_type", "flashcard"),
                    words_count=session_data.get("words_count", 0),
                    correct_count=session_data.get("correct_count", 0),
                    accuracy=Decimal(str(session_data.get("accuracy", 0.0))),
                    duration_seconds=session_data.get("duration_seconds", 0),
                    started_at=self._parse_datetime(session_data.get("started_at")),
                    completed_at=self._parse_datetime(session_data.get("completed_at")),
                )
                session_objects.append(session)
                
            except Exception as e:
                print(f"Error importing session: {str(e)}")
                continue
        
        if session_objects:
            db.add_all(session_objects)
    
    async def _update_user_stats(
        self, 
        db: Session, 
        user_id: str, 
        stats_data: Dict[str, Any]
    ) -> None:
        """Update user statistics from trial data."""
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.total_words_learned = stats_data.get("total_words_learned", 0)
            user.current_streak = stats_data.get("current_streak", 0)
            user.max_streak = stats_data.get("max_streak", 0)
            
            # Parse last active date
            last_active = stats_data.get("last_active_date")
            if last_active:
                user.last_active_date = self._parse_date(last_active)
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[date]:
        """Parse date string to date object."""
        if not date_str:
            return None
        
        try:
            if isinstance(date_str, str):
                return datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
            return date_str
        except (ValueError, AttributeError):
            return None
    
    def _parse_datetime(self, datetime_str: Optional[str]) -> Optional[datetime]:
        """Parse datetime string to datetime object."""
        if not datetime_str:
            return None
        
        try:
            if isinstance(datetime_str, str):
                return datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            return datetime_str
        except (ValueError, AttributeError):
            return None
    
    async def get_words_for_review(
        self, 
        db: Session, 
        user_id: str, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get words that need review for a user.
        
        Args:
            db: Database session
            user_id: User ID
            limit: Maximum number of words to return
            
        Returns:
            List of word progress data for review
        """
        try:
            # Get words due for review
            words = db.query(UserWord).filter(
                UserWord.user_id == user_id,
                UserWord.mastery_level < 4.0
            ).filter(
                (UserWord.next_review.is_(None)) | 
                (UserWord.next_review <= date.today())
            ).order_by(
                UserWord.mastery_level.asc(),
                UserWord.last_review.asc()
            ).limit(limit).all()
            
            return [
                {
                    "word_id": word.word_id,
                    "mastery_level": float(word.mastery_level),
                    "last_review": word.last_review.isoformat() if word.last_review else None,
                    "seen_count": word.seen_count,
                    "repetitions": word.repetitions
                }
                for word in words
            ]
            
        except Exception as e:
            raise Exception(f"Failed to get words for review: {str(e)}")
    
    async def sync_user_progress(
        self, 
        db: Session, 
        user_id: str, 
        sync_data: ProgressSyncData
    ) -> Dict[str, Any]:
        """
        Sync user progress from client to server.
        
        Args:
            db: Database session
            user_id: User ID
            sync_data: Progress data from client
            
        Returns:
            Sync result with conflicts and updated data
        """
        try:
            conflicts = []
            updated_words = 0
            
            # Process word progress updates
            for word_data in sync_data.words:
                try:
                    existing_word = db.query(UserWord).filter(
                        UserWord.user_id == user_id,
                        UserWord.word_id == word_data.word_id
                    ).first()
                    
                    if existing_word:
                        # Check for conflicts
                        if (existing_word.mastery_level != word_data.mastery_level or
                            existing_word.repetitions != word_data.repetitions):
                            conflicts.append({
                                "word_id": word_data.word_id,
                                "server_mastery": float(existing_word.mastery_level),
                                "client_mastery": word_data.mastery_level,
                                "resolution": "client_wins"
                            })
                        
                        # Update with client data (client wins strategy)
                        existing_word.mastery_level = Decimal(str(word_data.mastery_level))
                        existing_word.repetitions = word_data.repetitions
                        existing_word.ease_factor = Decimal(str(word_data.ease_factor))
                        existing_word.last_review = word_data.last_review
                        existing_word.next_review = word_data.next_review
                        existing_word.seen_count = word_data.seen_count
                        existing_word.correct_count = word_data.correct_count
                        existing_word.updated_at = datetime.utcnow()
                        
                    else:
                        # Create new word progress
                        new_word = UserWord(
                            user_id=user_id,
                            word_id=word_data.word_id,
                            mastery_level=Decimal(str(word_data.mastery_level)),
                            repetitions=word_data.repetitions,
                            ease_factor=Decimal(str(word_data.ease_factor)),
                            last_review=word_data.last_review,
                            next_review=word_data.next_review,
                            seen_count=word_data.seen_count,
                            correct_count=word_data.correct_count,
                        )
                        db.add(new_word)
                    
                    updated_words += 1
                    
                except Exception as e:
                    print(f"Error syncing word {word_data.word_id}: {str(e)}")
                    continue
            
            # Update user statistics
            user = db.query(User).filter(User.id == user_id).first()
            if user and sync_data.stats:
                user.total_words_learned = sync_data.stats.get("total_words_learned", user.total_words_learned)
                user.current_streak = sync_data.stats.get("current_streak", user.current_streak)
                user.max_streak = max(user.max_streak, sync_data.stats.get("max_streak", 0))
                user.last_active_date = date.today()
                user.updated_at = datetime.utcnow()
            
            db.commit()
            
            return {
                "updated_words": updated_words,
                "conflicts": conflicts,
                "sync_timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to sync progress: {str(e)}")
    
    async def get_user_progress_summary(
        self, 
        db: Session, 
        user_id: str
    ) -> Dict[str, Any]:
        """
        Get complete user progress summary for client sync.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Complete progress data for client
        """
        try:
            # Get user info
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise Exception("User not found")
            
            # Get word progress
            words = db.query(UserWord).filter(UserWord.user_id == user_id).all()
            word_progress = [
                {
                    "word_id": word.word_id,
                    "mastery_level": float(word.mastery_level),
                    "repetitions": word.repetitions,
                    "ease_factor": float(word.ease_factor),
                    "last_review": word.last_review.isoformat() if word.last_review else None,
                    "next_review": word.next_review.isoformat() if word.next_review else None,
                    "seen_count": word.seen_count,
                    "correct_count": word.correct_count,
                }
                for word in words
            ]
            
            # Get recent sessions (last 30 days)
            recent_sessions = db.query(DBSession).filter(
                DBSession.user_id == user_id,
                DBSession.started_at >= datetime.utcnow().replace(day=1)  # This month
            ).order_by(DBSession.started_at.desc()).limit(50).all()
            
            sessions_summary = [
                {
                    "id": session.id,
                    "practice_type": session.practice_type,
                    "words_count": session.words_count,
                    "correct_count": session.correct_count,
                    "accuracy": float(session.accuracy),
                    "duration_seconds": session.duration_seconds,
                    "started_at": session.started_at.isoformat(),
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                }
                for session in recent_sessions
            ]
            
            return {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "grade": user.grade,
                    "total_words_learned": user.total_words_learned,
                    "current_streak": user.current_streak,
                    "max_streak": user.max_streak,
                    "last_active_date": user.last_active_date.isoformat() if user.last_active_date else None,
                    "plan": user.plan,
                    "plan_status": user.plan_status,
                    "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
                },
                "words": word_progress,
                "sessions": sessions_summary,
                "sync_timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            raise Exception(f"Failed to get progress summary: {str(e)}")
