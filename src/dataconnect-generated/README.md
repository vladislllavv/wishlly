# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `ideas`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListApprovedIdeas*](#listapprovedideas)
- [**Mutations**](#mutations)
  - [*AddIdea*](#addidea)
  - [*RemoveIdea*](#removeidea)
  - [*ReportIdea*](#reportidea)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `ideas`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `ideas` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListApprovedIdeas
You can execute the `ListApprovedIdeas` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listApprovedIdeas(vars: ListApprovedIdeasVariables, options?: ExecuteQueryOptions): QueryPromise<ListApprovedIdeasData, ListApprovedIdeasVariables>;

interface ListApprovedIdeasRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListApprovedIdeasVariables): QueryRef<ListApprovedIdeasData, ListApprovedIdeasVariables>;
}
export const listApprovedIdeasRef: ListApprovedIdeasRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listApprovedIdeas(dc: DataConnect, vars: ListApprovedIdeasVariables, options?: ExecuteQueryOptions): QueryPromise<ListApprovedIdeasData, ListApprovedIdeasVariables>;

interface ListApprovedIdeasRef {
  ...
  (dc: DataConnect, vars: ListApprovedIdeasVariables): QueryRef<ListApprovedIdeasData, ListApprovedIdeasVariables>;
}
export const listApprovedIdeasRef: ListApprovedIdeasRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listApprovedIdeasRef:
```typescript
const name = listApprovedIdeasRef.operationName;
console.log(name);
```

### Variables
The `ListApprovedIdeas` query requires an argument of type `ListApprovedIdeasVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListApprovedIdeasVariables {
  interest: string;
  limit?: number | null;
}
```
### Return Type
Recall that executing the `ListApprovedIdeas` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListApprovedIdeasData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListApprovedIdeas`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listApprovedIdeas, ListApprovedIdeasVariables } from '@dataconnect/generated';

// The `ListApprovedIdeas` query requires an argument of type `ListApprovedIdeasVariables`:
const listApprovedIdeasVars: ListApprovedIdeasVariables = {
  interest: ..., 
  limit: ..., // optional
};

// Call the `listApprovedIdeas()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listApprovedIdeas(listApprovedIdeasVars);
// Variables can be defined inline as well.
const { data } = await listApprovedIdeas({ interest: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listApprovedIdeas(dataConnect, listApprovedIdeasVars);

console.log(data.ideaInterests);

// Or, you can use the `Promise` API.
listApprovedIdeas(listApprovedIdeasVars).then((response) => {
  const data = response.data;
  console.log(data.ideaInterests);
});
```

### Using `ListApprovedIdeas`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listApprovedIdeasRef, ListApprovedIdeasVariables } from '@dataconnect/generated';

// The `ListApprovedIdeas` query requires an argument of type `ListApprovedIdeasVariables`:
const listApprovedIdeasVars: ListApprovedIdeasVariables = {
  interest: ..., 
  limit: ..., // optional
};

// Call the `listApprovedIdeasRef()` function to get a reference to the query.
const ref = listApprovedIdeasRef(listApprovedIdeasVars);
// Variables can be defined inline as well.
const ref = listApprovedIdeasRef({ interest: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listApprovedIdeasRef(dataConnect, listApprovedIdeasVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.ideaInterests);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.ideaInterests);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `ideas` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## AddIdea
You can execute the `AddIdea` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addIdea(vars: AddIdeaVariables): MutationPromise<AddIdeaData, AddIdeaVariables>;

interface AddIdeaRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddIdeaVariables): MutationRef<AddIdeaData, AddIdeaVariables>;
}
export const addIdeaRef: AddIdeaRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addIdea(dc: DataConnect, vars: AddIdeaVariables): MutationPromise<AddIdeaData, AddIdeaVariables>;

interface AddIdeaRef {
  ...
  (dc: DataConnect, vars: AddIdeaVariables): MutationRef<AddIdeaData, AddIdeaVariables>;
}
export const addIdeaRef: AddIdeaRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addIdeaRef:
```typescript
const name = addIdeaRef.operationName;
console.log(name);
```

### Variables
The `AddIdea` mutation requires an argument of type `AddIdeaVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddIdeaVariables {
  ideaId: UUIDString;
}
```
### Return Type
Recall that executing the `AddIdea` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddIdeaData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddIdeaData {
  ideaAdd_upsert: IdeaAdd_Key;
}
```
### Using `AddIdea`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addIdea, AddIdeaVariables } from '@dataconnect/generated';

// The `AddIdea` mutation requires an argument of type `AddIdeaVariables`:
const addIdeaVars: AddIdeaVariables = {
  ideaId: ..., 
};

// Call the `addIdea()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addIdea(addIdeaVars);
// Variables can be defined inline as well.
const { data } = await addIdea({ ideaId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addIdea(dataConnect, addIdeaVars);

console.log(data.ideaAdd_upsert);

// Or, you can use the `Promise` API.
addIdea(addIdeaVars).then((response) => {
  const data = response.data;
  console.log(data.ideaAdd_upsert);
});
```

### Using `AddIdea`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addIdeaRef, AddIdeaVariables } from '@dataconnect/generated';

// The `AddIdea` mutation requires an argument of type `AddIdeaVariables`:
const addIdeaVars: AddIdeaVariables = {
  ideaId: ..., 
};

// Call the `addIdeaRef()` function to get a reference to the mutation.
const ref = addIdeaRef(addIdeaVars);
// Variables can be defined inline as well.
const ref = addIdeaRef({ ideaId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addIdeaRef(dataConnect, addIdeaVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ideaAdd_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ideaAdd_upsert);
});
```

## RemoveIdea
You can execute the `RemoveIdea` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeIdea(vars: RemoveIdeaVariables): MutationPromise<RemoveIdeaData, RemoveIdeaVariables>;

interface RemoveIdeaRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveIdeaVariables): MutationRef<RemoveIdeaData, RemoveIdeaVariables>;
}
export const removeIdeaRef: RemoveIdeaRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeIdea(dc: DataConnect, vars: RemoveIdeaVariables): MutationPromise<RemoveIdeaData, RemoveIdeaVariables>;

interface RemoveIdeaRef {
  ...
  (dc: DataConnect, vars: RemoveIdeaVariables): MutationRef<RemoveIdeaData, RemoveIdeaVariables>;
}
export const removeIdeaRef: RemoveIdeaRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeIdeaRef:
```typescript
const name = removeIdeaRef.operationName;
console.log(name);
```

### Variables
The `RemoveIdea` mutation requires an argument of type `RemoveIdeaVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveIdeaVariables {
  ideaId: UUIDString;
}
```
### Return Type
Recall that executing the `RemoveIdea` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveIdeaData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveIdeaData {
  ideaAdd_delete?: IdeaAdd_Key | null;
}
```
### Using `RemoveIdea`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeIdea, RemoveIdeaVariables } from '@dataconnect/generated';

// The `RemoveIdea` mutation requires an argument of type `RemoveIdeaVariables`:
const removeIdeaVars: RemoveIdeaVariables = {
  ideaId: ..., 
};

// Call the `removeIdea()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeIdea(removeIdeaVars);
// Variables can be defined inline as well.
const { data } = await removeIdea({ ideaId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeIdea(dataConnect, removeIdeaVars);

console.log(data.ideaAdd_delete);

// Or, you can use the `Promise` API.
removeIdea(removeIdeaVars).then((response) => {
  const data = response.data;
  console.log(data.ideaAdd_delete);
});
```

### Using `RemoveIdea`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeIdeaRef, RemoveIdeaVariables } from '@dataconnect/generated';

// The `RemoveIdea` mutation requires an argument of type `RemoveIdeaVariables`:
const removeIdeaVars: RemoveIdeaVariables = {
  ideaId: ..., 
};

// Call the `removeIdeaRef()` function to get a reference to the mutation.
const ref = removeIdeaRef(removeIdeaVars);
// Variables can be defined inline as well.
const ref = removeIdeaRef({ ideaId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeIdeaRef(dataConnect, removeIdeaVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ideaAdd_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ideaAdd_delete);
});
```

## ReportIdea
You can execute the `ReportIdea` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
reportIdea(vars: ReportIdeaVariables): MutationPromise<ReportIdeaData, ReportIdeaVariables>;

interface ReportIdeaRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReportIdeaVariables): MutationRef<ReportIdeaData, ReportIdeaVariables>;
}
export const reportIdeaRef: ReportIdeaRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reportIdea(dc: DataConnect, vars: ReportIdeaVariables): MutationPromise<ReportIdeaData, ReportIdeaVariables>;

interface ReportIdeaRef {
  ...
  (dc: DataConnect, vars: ReportIdeaVariables): MutationRef<ReportIdeaData, ReportIdeaVariables>;
}
export const reportIdeaRef: ReportIdeaRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reportIdeaRef:
```typescript
const name = reportIdeaRef.operationName;
console.log(name);
```

### Variables
The `ReportIdea` mutation requires an argument of type `ReportIdeaVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ReportIdeaVariables {
  ideaId: UUIDString;
  reason: string;
}
```
### Return Type
Recall that executing the `ReportIdea` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReportIdeaData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ReportIdeaData {
  ideaReport_upsert: IdeaReport_Key;
}
```
### Using `ReportIdea`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reportIdea, ReportIdeaVariables } from '@dataconnect/generated';

// The `ReportIdea` mutation requires an argument of type `ReportIdeaVariables`:
const reportIdeaVars: ReportIdeaVariables = {
  ideaId: ..., 
  reason: ..., 
};

// Call the `reportIdea()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reportIdea(reportIdeaVars);
// Variables can be defined inline as well.
const { data } = await reportIdea({ ideaId: ..., reason: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reportIdea(dataConnect, reportIdeaVars);

console.log(data.ideaReport_upsert);

// Or, you can use the `Promise` API.
reportIdea(reportIdeaVars).then((response) => {
  const data = response.data;
  console.log(data.ideaReport_upsert);
});
```

### Using `ReportIdea`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reportIdeaRef, ReportIdeaVariables } from '@dataconnect/generated';

// The `ReportIdea` mutation requires an argument of type `ReportIdeaVariables`:
const reportIdeaVars: ReportIdeaVariables = {
  ideaId: ..., 
  reason: ..., 
};

// Call the `reportIdeaRef()` function to get a reference to the mutation.
const ref = reportIdeaRef(reportIdeaVars);
// Variables can be defined inline as well.
const ref = reportIdeaRef({ ideaId: ..., reason: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reportIdeaRef(dataConnect, reportIdeaVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.ideaReport_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.ideaReport_upsert);
});
```

