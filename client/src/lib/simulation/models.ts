// simulation/models.ts

export type ID = string;

export interface Node {
  id: ID;
  name: string;
  networkId?: ID;
}

export interface Router {
  id: ID;
  name: string;
  networkIds: ID[];
}

export interface Network {
  id: ID;
  name: string;
  nodeIds: ID[];
  routerIds: ID[];
}
