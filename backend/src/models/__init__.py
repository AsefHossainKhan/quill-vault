# Import all models so SQLAlchemy mapper resolves string-based relationships.
from .user import User  # noqa: F401
from .template import Template  # noqa: F401
from .recording import Recording  # noqa: F401
from .job import Job  # noqa: F401
from .transcript import Transcript  # noqa: F401
from .speaker import Speaker  # noqa: F401
from .chat_message import ChatMessage  # noqa: F401
