"""
Application configuration using Pydantic settings.
Handles environment variables and validation.
"""
import os
from typing import List, Optional
from pydantic import Field, field_validator, ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "WordMate API"
    DEBUG: bool = False
    
    # Database
    MYSQL_HOST: str = Field(default="localhost", description="MySQL host")
    MYSQL_PORT: int = Field(default=3306, description="MySQL port")
    MYSQL_USER: str = Field(default="test_user", description="MySQL username")
    MYSQL_PASSWORD: str = Field(default="test_password", description="MySQL password")
    MYSQL_DATABASE: str = Field(default="wordmate", description="MySQL database name")
    
    @property
    def DATABASE_URL(self) -> str:
        """Construct MySQL database URL."""
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            f"?charset=utf8mb4"
        )
    
    # JWT Configuration
    JWT_SECRET_KEY: str = Field(default="test_jwt_secret_key_not_for_production", description="JWT secret key")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    BACKEND_CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://localhost:5174",
        description="CORS allowed origins (comma-separated string)"
    )
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        """Convert CORS origins string to list."""
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]
        return self.BACKEND_CORS_ORIGINS
    
    # Payment Configuration
    ALIPAY_APP_ID: Optional[str] = None
    ALIPAY_PRIVATE_KEY: Optional[str] = None
    ALIPAY_PUBLIC_KEY: Optional[str] = None
    ALIPAY_GATEWAY_URL: str = "https://openapi.alipaydev.com/gateway.do"  # Sandbox
    
    WECHAT_APP_ID: Optional[str] = None
    WECHAT_MCH_ID: Optional[str] = None
    WECHAT_PRIVATE_KEY: Optional[str] = None
    WECHAT_APIV3_KEY: Optional[str] = None
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    model_config = ConfigDict(
        env_file=os.environ.get("ENV_FILE", ".env"),
        case_sensitive=True
    )


# Global settings instance
settings = Settings()
