/*
  Warnings:

  - Added the required column `deviceId` to the `UserTrackHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceName` to the `UserTrackHistory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SearchRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyword" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "SearchRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'MUSIC',
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Track" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT NOT NULL,
    "cover" TEXT,
    "duration" INTEGER,
    "lyrics" TEXT,
    "index" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'MUSIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileModifiedAt" DATETIME,
    "episodeNumber" INTEGER DEFAULT 0,
    "artistId" INTEGER,
    "albumId" INTEGER,
    "folderId" INTEGER,
    CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Track_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Track_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("album", "artist", "cover", "createdAt", "duration", "episodeNumber", "fileModifiedAt", "id", "index", "lyrics", "name", "path", "type") SELECT "album", "artist", "cover", "createdAt", "duration", "episodeNumber", "fileModifiedAt", "id", "index", "lyrics", "name", "path", "type" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE TABLE "new_UserAudiobookHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "trackId" INTEGER NOT NULL,
    "listenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserAudiobookHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAudiobookHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserAudiobookHistory" ("id", "listenedAt", "trackId", "userId") SELECT "id", "listenedAt", "trackId", "userId" FROM "UserAudiobookHistory";
DROP TABLE "UserAudiobookHistory";
ALTER TABLE "new_UserAudiobookHistory" RENAME TO "UserAudiobookHistory";
CREATE UNIQUE INDEX "UserAudiobookHistory_userId_trackId_key" ON "UserAudiobookHistory"("userId", "trackId");
CREATE TABLE "new_UserTrackHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "trackId" INTEGER NOT NULL,
    "listenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "deviceName" TEXT NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "isSyncMode" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserTrackHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserTrackHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserTrackHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserTrackHistory" ("id", "listenedAt", "trackId", "userId") SELECT "id", "listenedAt", "trackId", "userId" FROM "UserTrackHistory";
DROP TABLE "UserTrackHistory";
ALTER TABLE "new_UserTrackHistory" RENAME TO "UserTrackHistory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Folder_path_key" ON "Folder"("path");
