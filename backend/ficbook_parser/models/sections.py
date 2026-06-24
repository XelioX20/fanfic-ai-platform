from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Section:
    name: str
    path: str

    def with_query(self, query: dict) -> "SectionWithQuery":
        return SectionWithQuery(name=self.name, path=self.path, query=query)

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
    ALL = Section("Все", "fanfiction")
    GEN = Section("Джен", "fanfiction/gen")
    HET = Section("Гет", "fanfiction/het")
    SLASH = Section("Слэш", "fanfiction/slash")
    FEMSLASH = Section("Фемслэш", "fanfiction/femslash")
    OTHER = Section("Другое", "fanfiction/other")
    MIXED = Section("Смешанное", "fanfiction/mixed")
    ORIGINALS = Section("Оригинальные", "originals")

    ALL_SECTIONS = [ALL, GEN, HET, SLASH, FEMSLASH, OTHER, MIXED, ORIGINALS]


class CategoriesSections:
    ANIME = Section("Аниме", "fanfiction/anime")
    BOOKS = Section("Книги", "fanfiction/books")
    CARTOONS = Section("Мультфильмы", "fanfiction/cartoons")
    COMICS = Section("Комиксы", "fanfiction/comics")
    GAMES = Section("Игры", "fanfiction/games")
    MOVIES = Section("Фильмы", "fanfiction/movies")
    MUSIC = Section("Музыка", "fanfiction/music")
    SERIES = Section("Сериалы", "fanfiction/series")
    THEATER = Section("Театр", "fanfiction/theatre")
    SPORTS = Section("Спорт", "fanfiction/sport")
    OTHER = Section("Другое", "fanfiction/other")


class UserSections:
    FAVOURITES = SectionWithQuery("Избранное", "home/favourites")
    LIKED = SectionWithQuery("Понравившееся", "home/liked-fanfics")
    READ = SectionWithQuery("Прочитанное", "home/viewed")
    FOLLOW = SectionWithQuery("Подписки", "home/follow")
    VISITED = SectionWithQuery("Посещённое", "home/visited")

    ALL_SECTIONS = [FAVOURITES, LIKED, READ, FOLLOW, VISITED]


class CollectionsTypes:
    OWN = SectionWithQuery("Мои коллекции", "collections", {"type": "own"})
    TRACKED = SectionWithQuery("Отслеживаемые", "collections", {"type": "liked"})
