from dotenv import load_dotenv
import os

load_dotenv()

DB_HOST    = os.getenv("DB_HOST", "localhost")
DB_PORT    = os.getenv("DB_PORT", "3306")
DB_NAME    = os.getenv("DB_NAME", "travel_planner")
DB_USER    = os.getenv("DB_USER", "root")
DB_PASS    = os.getenv("DB_PASS", "")

SECRET_KEY                  = os.getenv("SECRET_KEY", "")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

_INSECURE_KEYS = {"", "secret", "changeme", "default"}
if SECRET_KEY in _INSECURE_KEYS or len(SECRET_KEY) < 32:
    if os.getenv("ENV", "dev").lower() == "production":
        raise RuntimeError(
            "SECRET_KEY is missing or too weak. Set a strong SECRET_KEY (>=32 chars) in .env"
        )
    import secrets, warnings
    SECRET_KEY = secrets.token_urlsafe(48)
    warnings.warn(
        "SECRET_KEY is missing or weak. Generated a temporary key for this run. "
        "All existing JWT tokens are now invalid. Set SECRET_KEY in .env to persist sessions.",
        RuntimeWarning,
    )

DGIS_API_KEY = os.getenv("DGIS_API_KEY", "")
DGIS_BASE_URL = "https://catalog.api.2gis.com/3.0"

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OPENWEATHER_BASE_URL = "https://api.openweathermap.org"