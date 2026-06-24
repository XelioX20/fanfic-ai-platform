HTTPS_SCHEME = "https"
FICBOOK_HOST = "ficbook.net"
FICBOOK_BASE_URL = f"{HTTPS_SCHEME}://{FICBOOK_HOST}"

# Auth endpoints
REGISTRATION_URL = f"{FICBOOK_BASE_URL}/register"
LOGIN_URL = f"{FICBOOK_BASE_URL}/login"

# Routes (from Constants.kt)
ROUTE_RANDOM_FIC = "randomfic"
ROUTE_READ_FIC = "readfic"
ROUTE_AUTHORS = "authors"
ROUTE_NOTIFICATIONS = "notifications"
ROUTE_FIND = "find"
ROUTE_FANFICTION = "fanfiction"
ROUTE_COLLECTIONS = "collections"
ROUTE_REQUESTS = "requests"
ROUTE_SETTINGS = "settings"
ROUTE_LIKED = "liked-fanfics"
ROUTE_FAVOURITES = "favourites"
ROUTE_VIEWED = "viewed"
ROUTE_FOLLOW = "follow"
ROUTE_COMMENTS = "comments"
ROUTE_REWARDS = "rewards"

# Query params
QUERY_PAGE = "p"
QUERY_TAB = "tab"
QUERY_SEARCH = "q"

# HTML selectors (from FanficListParser, FanficCardParser, FanficPageParser)
SELECTOR_FANFIC_CARD = "article[class*=fanfic-inline]"
SELECTOR_FANFIC_TITLE = "h3.fanfic-inline-title a"
SELECTOR_FANFIC_AUTHOR = "span.author a"
SELECTOR_FANFIC_DESCRIPTION = "div.fanfic-description"
SELECTOR_FANFIC_TAGS = "div.tags a"
SELECTOR_FANFIC_FANDOM = "span.fandom-name"
SELECTOR_FANFIC_PAIRING = "div.pairing-parent"
SELECTOR_FANFIC_COVER = "img.fanfic-main-cover"
SELECTOR_LIKES = "span.badge-like"
SELECTOR_TROPHIES = "span.badge-reward"
SELECTOR_SIZE = "span.badge-text"
SELECTOR_STATUS = "span.badge-status"
SELECTOR_RATING = "span.badge-rating"
SELECTOR_DIRECTION = "span.badge-direction"
SELECTOR_PAGINATION_NEXT = "li.next a"

# Part content anchor
PART_CONTENT_ANCHOR = "#content"

# Regex
NOT_NUMBER_REGEX = r"[^0-9]"
