from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Section:
    name: str
    path: str

    def __str__(self) -> str:
        return self.path


@dataclass
class SectionWithQuery:
    name: str = ""
    path: str = ""
    query: dict = field(default_factory=dict)

    def to_url_path(self) -> str:
        if not self.query:
            return self.path
        params = "&".join(f"{k}={v}" for k, v in self.query.items())
        return f"{self.path}?{params}"

    def __str__(self) -> str:
        return self.to_url_path()


class PopularSections:
    """Correct obfuscated paths from B1ays/ficbook-reader source."""
    ALL = Section("Все", "popular-fanfics-376846")
    GEN = Section("Джен", "popular-fanfics-376846/gen")
    HET = Section("Гет", "popular-fanfics-376846/het")
    SLASH = Section("Слэш", "popular-fanfics-376846/slash-fics-ngf3487tnsfb")
    FEMSLASH = Section("Фемслэш", "popular-fanfics-376846/femslash-fanfics-kojhi9jhhmkhgi9t98")
    ARTICLE = Section("Статьи", "popular-fanfics-376846/article")
    MIXED = Section("Смешанное", "popular-fanfics-376846/mixed")
    OTHER = Section("Другое", "popular-fanfics-376846/other")
    ALL_SECTIONS = [ALL, GEN, HET, SLASH, FEMSLASH, ARTICLE, MIXED, OTHER]


class CategoriesSections:
    ANIME = Section("Аниме и манга", "fanfiction/anime_and_manga")
    BOOKS = Section("Книги", "fanfiction/books")
    CARTOONS = Section("Мультфильмы", "fanfiction/cartoons")
    COMICS = Section("Комиксы", "fanfiction/comics")
    GAMES = Section("Игры", "fanfiction/games")
    MOVIES = Section("Фильмы и сериалы", "fanfiction/movies_and_tv_series")
    MUSICALS = Section("Мюзиклы", "fanfiction/musicals")
    RPF = Section("RPF", "fanfiction/rpf")
    ORIGINALS = Section("Оригинальные", "fanfiction/originals")
    OTHER = Section("Другое", "fanfiction/other")


class UserSections:
    """Correct paths from B1ays — these differ from what we had before."""
    FAVOURITES = SectionWithQuery("Подписки на авторов", "home/favourites")
    LIKED = SectionWithQuery("Понравившееся", "home/liked_fanfics")      # NOT liked-fanfics
    READ = SectionWithQuery("Прочитанное", "home/readedList")             # NOT viewed
    FOLLOW = SectionWithQuery("Подписки на фанфики", "home/followList")  # NOT follow
    VISITED = SectionWithQuery("Просмотренные", "home/visitedList")

    ALL_SECTIONS = [FAVOURITES, LIKED, READ, FOLLOW, VISITED]


class CollectionsTypes:
    OWN = SectionWithQuery("Мои коллекции", "home/collections")
    TRACKED = SectionWithQuery("Отслеживаемые", "home/collections", {"type": "other"})
