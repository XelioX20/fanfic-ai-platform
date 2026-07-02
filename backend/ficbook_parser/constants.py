HTTPS_SCHEME = "https"
FICBOOK_HOST = "ficbook.net"
FICBOOK_BASE_URL = f"{HTTPS_SCHEME}://{FICBOOK_HOST}"

# Auth endpoints — POST /login_check returns JSON, no CSRF needed
LOGIN_URL = f"{FICBOOK_BASE_URL}/login"
LOGIN_CHECK_URL = f"{FICBOOK_BASE_URL}/login_check"

# Routes
ROUTE_RANDOM_FIC = "randomfic"
ROUTE_READ_FIC = "readfic"
ROUTE_AUTHORS = "authors"
ROUTE_NOTIFICATIONS = "notifications"
# Correct search path from reverse engineering (not /find which 403s from datacenter)
ROUTE_FIND = "find-fanfics-846555"
ROUTE_FANFICTION = "fanfiction"
ROUTE_COLLECTIONS = "collections"
ROUTE_REQUESTS = "requests"
ROUTE_SETTINGS = "settings"
# Correct personal section paths (from B1ays/ficbook-reader source)
ROUTE_LIKED = "home/liked_fanfics"        # NOT liked-fanfics
ROUTE_FAVOURITES = "home/favourites"
ROUTE_READ_LIST = "home/readedList"       # NOT viewed
ROUTE_FOLLOW_LIST = "home/followList"     # NOT follow
ROUTE_VISITED = "home/visitedList"
ROUTE_COMMENTS = "comments"
ROUTE_REWARDS = "rewards"

# Popular sections (obfuscated slugs from B1ays)
POPULAR_ALL = "popular-fanfics-376846"
POPULAR_GEN = "popular-fanfics-376846/gen"
POPULAR_HET = "popular-fanfics-376846/het"
POPULAR_SLASH = "popular-fanfics-376846/slash-fics-ngf3487tnsfb"
POPULAR_FEMSLASH = "popular-fanfics-376846/femslash-fanfics-kojhi9jhhmkhgi9t98"
POPULAR_ARTICLE = "popular-fanfics-376846/article"
POPULAR_MIXED = "popular-fanfics-376846/mixed"
POPULAR_OTHER = "popular-fanfics-376846/other"

# Category sections
CATEGORY_ANIME = "fanfiction/anime_and_manga"
CATEGORY_BOOKS = "fanfiction/books"
CATEGORY_CARTOONS = "fanfiction/cartoons"
CATEGORY_GAMES = "fanfiction/games"
CATEGORY_MOVIES = "fanfiction/movies_and_tv_series"
CATEGORY_RPF = "fanfiction/rpf"
CATEGORY_ORIGINALS = "fanfiction/originals"
CATEGORY_COMICS = "fanfiction/comics"
CATEGORY_MUSICALS = "fanfiction/musicals"

# Ajax JSON endpoints (confirmed to return JSON, work without proxy)
AJAX_MARK = "ajax/mark"
AJAX_USER_INFO = "ajax/user_info"
AJAX_FANDOMS_CHARACTERS = "ajax/fandoms/characters"
AJAX_FANFIC_ACTIONS = "ajax/fanfic_actions_state"

# Search JSON endpoints
SEARCH_FANDOMS = "fandoms/search"
SEARCH_TAGS = "tags/search"
SEARCH_AUTHORS = "authors/search"

# Query params
QUERY_PAGE = "p"
QUERY_TAB = "tab"
QUERY_SEARCH = "title"  # Correct param name from ficbookapi source

# CSS selectors (updated for 2025 ficbook layout)
SELECTOR_FANFIC_CARD = "article.fanfic-inline, article[class*=fanfic-inline]"
SELECTOR_PAGINATION_NEXT = "li.next:not(.disabled) a"

# Regex
NOT_NUMBER_REGEX = r"[^0-9]"
