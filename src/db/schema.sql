CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY,
  mbid TEXT NOT NULL UNIQUE,
  source_artist_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  sort_name TEXT,
  disambiguation TEXT
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY,
  mbid TEXT NOT NULL UNIQUE,
  source_release_group_id INTEGER UNIQUE,
  source_artist_credit_id INTEGER,
  title TEXT NOT NULL,
  first_release_date TEXT,
  type TEXT,
  disambiguation TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY,
  mbid TEXT NOT NULL UNIQUE,
  source_recording_id INTEGER UNIQUE,
  title TEXT NOT NULL,
  length INTEGER,
  disambiguation TEXT
);

CREATE TABLE IF NOT EXISTS mb_artist_credit_names (
  source_artist_credit_id INTEGER NOT NULL,
  source_artist_id INTEGER NOT NULL,
  position INTEGER,
  name TEXT,
  join_phrase TEXT,
  PRIMARY KEY (
    source_artist_credit_id,
    source_artist_id,
    position
  )
);

CREATE TABLE IF NOT EXISTS artist_albums (
  artist_id INTEGER NOT NULL,
  album_id INTEGER NOT NULL,
  PRIMARY KEY (artist_id, album_id)
);

CREATE TABLE IF NOT EXISTS album_tracks (
  album_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  position INTEGER,
  track_number TEXT,
  title_on_release TEXT,
  PRIMARY KEY (album_id, track_id)
);

CREATE TABLE IF NOT EXISTS track_samples (
  track_id INTEGER NOT NULL,
  sampled_track_id INTEGER NOT NULL,
  relationship_type TEXT NOT NULL,
  PRIMARY KEY (track_id, sampled_track_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS mb_mediums (
  source_medium_id INTEGER PRIMARY KEY,
  source_release_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mb_releases (
  source_release_id INTEGER PRIMARY KEY,
  source_release_group_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mb_tracks (
  source_track_id INTEGER PRIMARY KEY,
  source_recording_id INTEGER NOT NULL,
  source_medium_id INTEGER NOT NULL,
  position INTEGER,
  track_number TEXT,
  title TEXT
);

CREATE TABLE IF NOT EXISTS mb_sample_edges (
  source_recording_id INTEGER NOT NULL,
  sampled_recording_id INTEGER NOT NULL,
  relationship_type TEXT NOT NULL,
  PRIMARY KEY (
    source_recording_id,
    sampled_recording_id,
    relationship_type
  )
);

CREATE TABLE IF NOT EXISTS mb_sample_links (
  source_link_id INTEGER PRIMARY KEY,
  source_link_type_id INTEGER NOT NULL,
  relationship_type TEXT NOT NULL
);



CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_source ON artists(source_artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_source ON albums(source_release_group_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist_credit ON albums(source_artist_credit_id);
CREATE INDEX IF NOT EXISTS idx_tracks_source ON tracks(source_recording_id);

CREATE INDEX IF NOT EXISTS idx_mb_artist_credit_names_credit
ON mb_artist_credit_names(source_artist_credit_id);

CREATE INDEX IF NOT EXISTS idx_mb_artist_credit_names_artist
ON mb_artist_credit_names(source_artist_id);

CREATE INDEX IF NOT EXISTS idx_artist_albums_artist ON artist_albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_albums_album ON artist_albums(album_id);
CREATE INDEX IF NOT EXISTS idx_album_tracks_album ON album_tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_album_tracks_track ON album_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_track_samples_track ON track_samples(track_id);
CREATE INDEX IF NOT EXISTS idx_track_samples_sampled ON track_samples(sampled_track_id);

CREATE INDEX IF NOT EXISTS idx_mb_mediums_release ON mb_mediums(source_release_id);
CREATE INDEX IF NOT EXISTS idx_mb_releases_group ON mb_releases(source_release_group_id);
CREATE INDEX IF NOT EXISTS idx_mb_tracks_recording ON mb_tracks(source_recording_id);
CREATE INDEX IF NOT EXISTS idx_mb_tracks_medium ON mb_tracks(source_medium_id);
CREATE INDEX IF NOT EXISTS idx_mb_sample_edges_source ON mb_sample_edges(source_recording_id);
CREATE INDEX IF NOT EXISTS idx_mb_sample_edges_sampled ON mb_sample_edges(sampled_recording_id);

CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title);
CREATE INDEX IF NOT EXISTS idx_albums_title_nocase ON albums(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tracks_title_nocase ON tracks(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_album_tracks_album_position ON album_tracks(album_id, position);

CREATE INDEX IF NOT EXISTS idx_mb_sample_links_type ON mb_sample_links(source_link_type_id);

CREATE INDEX IF NOT EXISTS idx_artists_name_nocase ON artists(name COLLATE NOCASE);
