# backend/models/__init__.py — правильный порядок импортов
from models.budget     import Currency, CurrencyRateHistory, BudgetCategory, BudgetItem
from models.user       import User, UserSettings
from models.trip       import Trip, TripMember, TripTag
from models.location   import Location, LocationCategory, TripItinerary
from models.task       import Task, TaskCategory
from models.invitation   import Invitation
from models.notification import Notification
from models.attachment   import Attachment
from models.comment      import TripComment