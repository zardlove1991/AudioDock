import { Folder, TrackType } from "./models";
import { request } from "./request";

export interface FolderContents extends Folder {
  breadcrumbs: Folder[];
}

export const getFolderRoots = (type: TrackType) => {
  return request.get<Folder[]>(`/folders/roots`, { params: { type } });
};

export const getFolderContents = (id: number) => {
  return request.get<FolderContents>(`/folders/${id}/contents`);
};

export const getFolderStats = (id: number) => {
  return request.get<any>(`/folders/${id}/stats`);
};

export const deleteFolder = (id: number) => {
  return request.delete<any>(`/folders/${id}`);
};

export const batchDeleteItems = (data: { folderIds: number[]; trackIds: number[] }) => {
  return request.post<any>(`/folders/batch-delete`, data);
};
