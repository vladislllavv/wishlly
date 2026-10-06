import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AddIdeaData {
  ideaAdd_upsert: IdeaAdd_Key;
}

export interface AddIdeaVariables {
  ideaId: UUIDString;
}

export interface FeedProductInterest_Key {
  productId: UUIDString;
  interest: string;
  __typename?: 'FeedProductInterest_Key';
}

export interface FeedProduct_Key {
  id: UUIDString;
  __typename?: 'FeedProduct_Key';
}

export interface IdeaAdd_Key {
  ideaId: UUIDString;
  userId: string;
  __typename?: 'IdeaAdd_Key';
}

export interface IdeaInterest_Key {
  ideaId: UUIDString;
  interest: string;
  __typename?: 'IdeaInterest_Key';
}

export interface IdeaItem_Key {
  id: UUIDString;
  __typename?: 'IdeaItem_Key';
}

export interface IdeaReport_Key {
  ideaId: UUIDString;
  reporterId: string;
  __typename?: 'IdeaReport_Key';
}

export interface ListApprovedIdeasData {
  ideaInterests: ({
    idea: {
      id: UUIDString;
      title: string;
      imageUrl: string;
      link: string;
      priceAmount?: number | null;
      priceCurrency?: string | null;
      createdAt: TimestampString;
      ideaAdds_on_idea: ({
        _count: number;
      })[];
    } & IdeaItem_Key;
  })[];
}

export interface ListApprovedIdeasVariables {
  interest: string;
  limit?: number | null;
}

export interface RemoveIdeaData {
  ideaAdd_delete?: IdeaAdd_Key | null;
}

export interface RemoveIdeaVariables {
  ideaId: UUIDString;
}

export interface ReportIdeaData {
  ideaReport_upsert: IdeaReport_Key;
}

export interface ReportIdeaVariables {
  ideaId: UUIDString;
  reason: string;
}

interface AddIdeaRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddIdeaVariables): MutationRef<AddIdeaData, AddIdeaVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddIdeaVariables): MutationRef<AddIdeaData, AddIdeaVariables>;
  operationName: string;
}
export const addIdeaRef: AddIdeaRef;

export function addIdea(vars: AddIdeaVariables): MutationPromise<AddIdeaData, AddIdeaVariables>;
export function addIdea(dc: DataConnect, vars: AddIdeaVariables): MutationPromise<AddIdeaData, AddIdeaVariables>;

interface RemoveIdeaRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveIdeaVariables): MutationRef<RemoveIdeaData, RemoveIdeaVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveIdeaVariables): MutationRef<RemoveIdeaData, RemoveIdeaVariables>;
  operationName: string;
}
export const removeIdeaRef: RemoveIdeaRef;

export function removeIdea(vars: RemoveIdeaVariables): MutationPromise<RemoveIdeaData, RemoveIdeaVariables>;
export function removeIdea(dc: DataConnect, vars: RemoveIdeaVariables): MutationPromise<RemoveIdeaData, RemoveIdeaVariables>;

interface ReportIdeaRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReportIdeaVariables): MutationRef<ReportIdeaData, ReportIdeaVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReportIdeaVariables): MutationRef<ReportIdeaData, ReportIdeaVariables>;
  operationName: string;
}
export const reportIdeaRef: ReportIdeaRef;

export function reportIdea(vars: ReportIdeaVariables): MutationPromise<ReportIdeaData, ReportIdeaVariables>;
export function reportIdea(dc: DataConnect, vars: ReportIdeaVariables): MutationPromise<ReportIdeaData, ReportIdeaVariables>;

interface ListApprovedIdeasRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListApprovedIdeasVariables): QueryRef<ListApprovedIdeasData, ListApprovedIdeasVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListApprovedIdeasVariables): QueryRef<ListApprovedIdeasData, ListApprovedIdeasVariables>;
  operationName: string;
}
export const listApprovedIdeasRef: ListApprovedIdeasRef;

export function listApprovedIdeas(vars: ListApprovedIdeasVariables, options?: ExecuteQueryOptions): QueryPromise<ListApprovedIdeasData, ListApprovedIdeasVariables>;
export function listApprovedIdeas(dc: DataConnect, vars: ListApprovedIdeasVariables, options?: ExecuteQueryOptions): QueryPromise<ListApprovedIdeasData, ListApprovedIdeasVariables>;

