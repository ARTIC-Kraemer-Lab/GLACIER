export interface IRepo {
  id: string;
  name: string;
  url: string;
  path: string;
  version: string;
  params?: { [key: string]: string };
}

export interface IRepoVersions extends IRepo {
  versions: string[];
}
