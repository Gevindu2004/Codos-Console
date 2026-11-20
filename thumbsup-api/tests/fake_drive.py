"""An in-memory Google Drive that behaves like the real API for ThumbsUp's needs."""

import itertools
from datetime import datetime, timedelta, timezone

from app.services import drive

_ids = itertools.count(1)
_clock = itertools.count(1)


class FakeDrive:
    def __init__(self):
        self.items = {}  # id -> dict
        self.shared = set()  # folder ids shared with the robot
        self.changes = []  # (seq, file_id, parents)
        self.downloads = 0

    # ------------------------------------------------ test helpers (what a customer does in Drive)
    def folder(self, name, parent=None, share=False):
        fid = f"fold{next(_ids):06d}xxxxxxxxxxxx"
        self.items[fid] = {"name": name, "mime": drive.FOLDER_MIME, "parent": parent, "content": b"", "version": 1}
        if share:
            self.shared.add(fid)
        self._changed(fid)
        return fid

    def upload(self, parent, name, content=b"data", mime="image/jpeg"):
        fid = f"file{next(_ids):06d}xxxxxxxxxxxx"
        self.items[fid] = {"name": name, "mime": mime, "parent": parent, "content": content, "version": 1,
                           "modified": datetime.now(timezone.utc) + timedelta(seconds=next(_clock))}
        self._changed(fid)
        return fid

    def new_version(self, fid, content):
        it = self.items[fid]
        it["content"], it["version"] = content, it["version"] + 1
        it["modified"] = datetime.now(timezone.utc) + timedelta(seconds=next(_clock))
        self._changed(fid)

    def rename(self, fid, name):
        self.items[fid]["name"] = name
        self._changed(fid)

    def delete(self, fid):
        parent = self.items[fid]["parent"]
        del self.items[fid]
        self.changes.append((len(self.changes) + 1, fid, [parent]))

    def unshare(self, fid):
        self.shared.discard(fid)

    def _changed(self, fid):
        self.changes.append((len(self.changes) + 1, fid, [self.items[fid]["parent"]]))

    # ------------------------------------------------ DriveClient interface
    def _visible(self, fid):
        cur = fid
        while cur is not None:
            if cur in self.shared:
                return True
            cur = self.items.get(cur, {}).get("parent")
        return False

    def _file(self, fid):
        it = self.items[fid]
        return drive.DriveFile(id=fid, name=it["name"], mime_type=it["mime"], size=len(it["content"]),
                               md5=None, version=str(it["version"]), modified_at=it.get("modified"))

    def get(self, file_id):
        if file_id not in self.items or not self._visible(file_id):
            raise drive.DriveAccessError("File not found", status=404)
        return self._file(file_id)

    def list_children(self, folder_id):
        if not self._visible(folder_id):
            raise drive.DriveAccessError("File not found", status=404)
        return [self._file(fid) for fid, it in self.items.items() if it["parent"] == folder_id]

    def download(self, f, dest_path, max_bytes):
        self.downloads += 1
        it = self.items[f.id]
        data = it["content"]
        mime = it["mime"]
        if f.is_google_doc:
            data, mime = b"%PDF exported " + data, drive.GOOGLE_EXPORTS[it["mime"]][1]
        with open(dest_path, "wb") as fh:
            fh.write(data)
        return mime, len(data)

    def start_page_token(self):
        return str(len(self.changes) + 1)

    def list_changes(self, page_token):
        start = int(page_token)
        out = [{"fileId": fid, "removed": False, "parents": parents} for seq, fid, parents in self.changes if seq >= start]
        return out, str(len(self.changes) + 1)

    def watch_changes(self, *a, **k):
        return {"resourceId": "res-1", "expiration": "0"}

    def stop_channel(self, *a):
        pass
