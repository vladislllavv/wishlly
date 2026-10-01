# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `wishlly`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*MyProfile*](#myprofile)
  - [*GetProfile*](#getprofile)
  - [*ListInterests*](#listinterests)
  - [*WishesOfOwner*](#wishesofowner)
  - [*GroupsOfOwner*](#groupsofowner)
  - [*ReservationsOfOwner*](#reservationsofowner)
  - [*MyReservedWishes*](#myreservedwishes)
  - [*MyFriendships*](#myfriendships)
  - [*MySwipes*](#myswipes)
  - [*IdeasByInterests*](#ideasbyinterests)
- [**Mutations**](#mutations)
  - [*UpsertMyProfile*](#upsertmyprofile)
  - [*AddMyInterest*](#addmyinterest)
  - [*RemoveMyInterest*](#removemyinterest)
  - [*CreateGroup*](#creategroup)
  - [*RenameGroup*](#renamegroup)
  - [*DeleteGroup*](#deletegroup)
  - [*CreateWish*](#createwish)
  - [*CreateWishInGroup*](#createwishingroup)
  - [*UpdateWish*](#updatewish)
  - [*MoveWishToGroup*](#movewishtogroup)
  - [*UngroupWish*](#ungroupwish)
  - [*DeleteWish*](#deletewish)
  - [*AddWishInterest*](#addwishinterest)
  - [*RemoveWishInterest*](#removewishinterest)
  - [*ReserveWish*](#reservewish)
  - [*UnreserveWish*](#unreservewish)
  - [*JoinWishlist*](#joinwishlist)
  - [*LeaveWishlist*](#leavewishlist)
  - [*SaveSwipe*](#saveswipe)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `wishlly`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

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

Below are examples of how to use the `wishlly` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## MyProfile
You can execute the `MyProfile` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
myProfile(options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;

interface MyProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyProfileData, undefined>;
}
export const myProfileRef: MyProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
myProfile(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;

interface MyProfileRef {
  ...
  (dc: DataConnect): QueryRef<MyProfileData, undefined>;
}
export const myProfileRef: MyProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the myProfileRef:
```typescript
const name = myProfileRef.operationName;
console.log(name);
```

### Variables
The `MyProfile` query has no variables.
### Return Type
Recall that executing the `MyProfile` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MyProfileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MyProfileData {
  profile?: {
    uid: string;
    firstName?: string | null;
    birthdate?: DateString | null;
    gender?: string | null;
    onboardingCompleted: boolean;
    interests: ({
      interest: {
        name: string;
      } & Interest_Key;
    })[];
  } & Profile_Key;
}
```
### Using `MyProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myProfile } from '@dataconnect/generated';


// Call the `myProfile()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await myProfile();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await myProfile(dataConnect);

console.log(data.profile);

// Or, you can use the `Promise` API.
myProfile().then((response) => {
  const data = response.data;
  console.log(data.profile);
});
```

### Using `MyProfile`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, myProfileRef } from '@dataconnect/generated';


// Call the `myProfileRef()` function to get a reference to the query.
const ref = myProfileRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = myProfileRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.profile);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.profile);
});
```

## GetProfile
You can execute the `GetProfile` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getProfile(vars: GetProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetProfileData, GetProfileVariables>;

interface GetProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProfileVariables): QueryRef<GetProfileData, GetProfileVariables>;
}
export const getProfileRef: GetProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getProfile(dc: DataConnect, vars: GetProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetProfileData, GetProfileVariables>;

interface GetProfileRef {
  ...
  (dc: DataConnect, vars: GetProfileVariables): QueryRef<GetProfileData, GetProfileVariables>;
}
export const getProfileRef: GetProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getProfileRef:
```typescript
const name = getProfileRef.operationName;
console.log(name);
```

### Variables
The `GetProfile` query requires an argument of type `GetProfileVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetProfileVariables {
  uid: string;
}
```
### Return Type
Recall that executing the `GetProfile` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetProfileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetProfileData {
  profile?: {
    uid: string;
    firstName?: string | null;
    birthdate?: DateString | null;
    gender?: string | null;
    interests: ({
      interest: {
        name: string;
      } & Interest_Key;
    })[];
  } & Profile_Key;
}
```
### Using `GetProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getProfile, GetProfileVariables } from '@dataconnect/generated';

// The `GetProfile` query requires an argument of type `GetProfileVariables`:
const getProfileVars: GetProfileVariables = {
  uid: ..., 
};

// Call the `getProfile()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getProfile(getProfileVars);
// Variables can be defined inline as well.
const { data } = await getProfile({ uid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getProfile(dataConnect, getProfileVars);

console.log(data.profile);

// Or, you can use the `Promise` API.
getProfile(getProfileVars).then((response) => {
  const data = response.data;
  console.log(data.profile);
});
```

### Using `GetProfile`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getProfileRef, GetProfileVariables } from '@dataconnect/generated';

// The `GetProfile` query requires an argument of type `GetProfileVariables`:
const getProfileVars: GetProfileVariables = {
  uid: ..., 
};

// Call the `getProfileRef()` function to get a reference to the query.
const ref = getProfileRef(getProfileVars);
// Variables can be defined inline as well.
const ref = getProfileRef({ uid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getProfileRef(dataConnect, getProfileVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.profile);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.profile);
});
```

## ListInterests
You can execute the `ListInterests` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listInterests(options?: ExecuteQueryOptions): QueryPromise<ListInterestsData, undefined>;

interface ListInterestsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListInterestsData, undefined>;
}
export const listInterestsRef: ListInterestsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listInterests(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListInterestsData, undefined>;

interface ListInterestsRef {
  ...
  (dc: DataConnect): QueryRef<ListInterestsData, undefined>;
}
export const listInterestsRef: ListInterestsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listInterestsRef:
```typescript
const name = listInterestsRef.operationName;
console.log(name);
```

### Variables
The `ListInterests` query has no variables.
### Return Type
Recall that executing the `ListInterests` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListInterestsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListInterestsData {
  interests: ({
    name: string;
  } & Interest_Key)[];
}
```
### Using `ListInterests`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listInterests } from '@dataconnect/generated';


// Call the `listInterests()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listInterests();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listInterests(dataConnect);

console.log(data.interests);

// Or, you can use the `Promise` API.
listInterests().then((response) => {
  const data = response.data;
  console.log(data.interests);
});
```

### Using `ListInterests`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listInterestsRef } from '@dataconnect/generated';


// Call the `listInterestsRef()` function to get a reference to the query.
const ref = listInterestsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listInterestsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.interests);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.interests);
});
```

## WishesOfOwner
You can execute the `WishesOfOwner` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
wishesOfOwner(vars: WishesOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<WishesOfOwnerData, WishesOfOwnerVariables>;

interface WishesOfOwnerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: WishesOfOwnerVariables): QueryRef<WishesOfOwnerData, WishesOfOwnerVariables>;
}
export const wishesOfOwnerRef: WishesOfOwnerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
wishesOfOwner(dc: DataConnect, vars: WishesOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<WishesOfOwnerData, WishesOfOwnerVariables>;

interface WishesOfOwnerRef {
  ...
  (dc: DataConnect, vars: WishesOfOwnerVariables): QueryRef<WishesOfOwnerData, WishesOfOwnerVariables>;
}
export const wishesOfOwnerRef: WishesOfOwnerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the wishesOfOwnerRef:
```typescript
const name = wishesOfOwnerRef.operationName;
console.log(name);
```

### Variables
The `WishesOfOwner` query requires an argument of type `WishesOfOwnerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface WishesOfOwnerVariables {
  ownerUid: string;
}
```
### Return Type
Recall that executing the `WishesOfOwner` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `WishesOfOwnerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface WishesOfOwnerData {
  wishes: ({
    id: UUIDString;
    title: string;
    priceAmount?: number | null;
    priceCurrency?: string | null;
    link?: string | null;
    imageUrl?: string | null;
    note?: string | null;
    shareToIdeas: boolean;
    createdAt: TimestampString;
    group?: {
      id: UUIDString;
      name: string;
    } & Group_Key;
    interests: ({
      interest: {
        name: string;
      } & Interest_Key;
    })[];
  } & Wish_Key)[];
}
```
### Using `WishesOfOwner`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, wishesOfOwner, WishesOfOwnerVariables } from '@dataconnect/generated';

// The `WishesOfOwner` query requires an argument of type `WishesOfOwnerVariables`:
const wishesOfOwnerVars: WishesOfOwnerVariables = {
  ownerUid: ..., 
};

// Call the `wishesOfOwner()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await wishesOfOwner(wishesOfOwnerVars);
// Variables can be defined inline as well.
const { data } = await wishesOfOwner({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await wishesOfOwner(dataConnect, wishesOfOwnerVars);

console.log(data.wishes);

// Or, you can use the `Promise` API.
wishesOfOwner(wishesOfOwnerVars).then((response) => {
  const data = response.data;
  console.log(data.wishes);
});
```

### Using `WishesOfOwner`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, wishesOfOwnerRef, WishesOfOwnerVariables } from '@dataconnect/generated';

// The `WishesOfOwner` query requires an argument of type `WishesOfOwnerVariables`:
const wishesOfOwnerVars: WishesOfOwnerVariables = {
  ownerUid: ..., 
};

// Call the `wishesOfOwnerRef()` function to get a reference to the query.
const ref = wishesOfOwnerRef(wishesOfOwnerVars);
// Variables can be defined inline as well.
const ref = wishesOfOwnerRef({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = wishesOfOwnerRef(dataConnect, wishesOfOwnerVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.wishes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.wishes);
});
```

## GroupsOfOwner
You can execute the `GroupsOfOwner` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
groupsOfOwner(vars: GroupsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<GroupsOfOwnerData, GroupsOfOwnerVariables>;

interface GroupsOfOwnerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GroupsOfOwnerVariables): QueryRef<GroupsOfOwnerData, GroupsOfOwnerVariables>;
}
export const groupsOfOwnerRef: GroupsOfOwnerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
groupsOfOwner(dc: DataConnect, vars: GroupsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<GroupsOfOwnerData, GroupsOfOwnerVariables>;

interface GroupsOfOwnerRef {
  ...
  (dc: DataConnect, vars: GroupsOfOwnerVariables): QueryRef<GroupsOfOwnerData, GroupsOfOwnerVariables>;
}
export const groupsOfOwnerRef: GroupsOfOwnerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the groupsOfOwnerRef:
```typescript
const name = groupsOfOwnerRef.operationName;
console.log(name);
```

### Variables
The `GroupsOfOwner` query requires an argument of type `GroupsOfOwnerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GroupsOfOwnerVariables {
  ownerUid: string;
}
```
### Return Type
Recall that executing the `GroupsOfOwner` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GroupsOfOwnerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GroupsOfOwnerData {
  groups: ({
    id: UUIDString;
    name: string;
    createdAt: TimestampString;
  } & Group_Key)[];
}
```
### Using `GroupsOfOwner`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, groupsOfOwner, GroupsOfOwnerVariables } from '@dataconnect/generated';

// The `GroupsOfOwner` query requires an argument of type `GroupsOfOwnerVariables`:
const groupsOfOwnerVars: GroupsOfOwnerVariables = {
  ownerUid: ..., 
};

// Call the `groupsOfOwner()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await groupsOfOwner(groupsOfOwnerVars);
// Variables can be defined inline as well.
const { data } = await groupsOfOwner({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await groupsOfOwner(dataConnect, groupsOfOwnerVars);

console.log(data.groups);

// Or, you can use the `Promise` API.
groupsOfOwner(groupsOfOwnerVars).then((response) => {
  const data = response.data;
  console.log(data.groups);
});
```

### Using `GroupsOfOwner`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, groupsOfOwnerRef, GroupsOfOwnerVariables } from '@dataconnect/generated';

// The `GroupsOfOwner` query requires an argument of type `GroupsOfOwnerVariables`:
const groupsOfOwnerVars: GroupsOfOwnerVariables = {
  ownerUid: ..., 
};

// Call the `groupsOfOwnerRef()` function to get a reference to the query.
const ref = groupsOfOwnerRef(groupsOfOwnerVars);
// Variables can be defined inline as well.
const ref = groupsOfOwnerRef({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = groupsOfOwnerRef(dataConnect, groupsOfOwnerVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.groups);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.groups);
});
```

## ReservationsOfOwner
You can execute the `ReservationsOfOwner` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
reservationsOfOwner(vars: ReservationsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;

interface ReservationsOfOwnerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReservationsOfOwnerVariables): QueryRef<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;
}
export const reservationsOfOwnerRef: ReservationsOfOwnerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
reservationsOfOwner(dc: DataConnect, vars: ReservationsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;

interface ReservationsOfOwnerRef {
  ...
  (dc: DataConnect, vars: ReservationsOfOwnerVariables): QueryRef<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;
}
export const reservationsOfOwnerRef: ReservationsOfOwnerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reservationsOfOwnerRef:
```typescript
const name = reservationsOfOwnerRef.operationName;
console.log(name);
```

### Variables
The `ReservationsOfOwner` query requires an argument of type `ReservationsOfOwnerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ReservationsOfOwnerVariables {
  ownerUid: string;
}
```
### Return Type
Recall that executing the `ReservationsOfOwner` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReservationsOfOwnerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ReservationsOfOwnerData {
  reservations: ({
    wish: {
      id: UUIDString;
    } & Wish_Key;
    reservedBy?: {
      uid: string;
    } & Profile_Key;
  })[];
}
```
### Using `ReservationsOfOwner`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reservationsOfOwner, ReservationsOfOwnerVariables } from '@dataconnect/generated';

// The `ReservationsOfOwner` query requires an argument of type `ReservationsOfOwnerVariables`:
const reservationsOfOwnerVars: ReservationsOfOwnerVariables = {
  ownerUid: ..., 
};

// Call the `reservationsOfOwner()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reservationsOfOwner(reservationsOfOwnerVars);
// Variables can be defined inline as well.
const { data } = await reservationsOfOwner({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reservationsOfOwner(dataConnect, reservationsOfOwnerVars);

console.log(data.reservations);

// Or, you can use the `Promise` API.
reservationsOfOwner(reservationsOfOwnerVars).then((response) => {
  const data = response.data;
  console.log(data.reservations);
});
```

### Using `ReservationsOfOwner`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, reservationsOfOwnerRef, ReservationsOfOwnerVariables } from '@dataconnect/generated';

// The `ReservationsOfOwner` query requires an argument of type `ReservationsOfOwnerVariables`:
const reservationsOfOwnerVars: ReservationsOfOwnerVariables = {
  ownerUid: ..., 
};

// Call the `reservationsOfOwnerRef()` function to get a reference to the query.
const ref = reservationsOfOwnerRef(reservationsOfOwnerVars);
// Variables can be defined inline as well.
const ref = reservationsOfOwnerRef({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reservationsOfOwnerRef(dataConnect, reservationsOfOwnerVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.reservations);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.reservations);
});
```

## MyReservedWishes
You can execute the `MyReservedWishes` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
myReservedWishes(options?: ExecuteQueryOptions): QueryPromise<MyReservedWishesData, undefined>;

interface MyReservedWishesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyReservedWishesData, undefined>;
}
export const myReservedWishesRef: MyReservedWishesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
myReservedWishes(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyReservedWishesData, undefined>;

interface MyReservedWishesRef {
  ...
  (dc: DataConnect): QueryRef<MyReservedWishesData, undefined>;
}
export const myReservedWishesRef: MyReservedWishesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the myReservedWishesRef:
```typescript
const name = myReservedWishesRef.operationName;
console.log(name);
```

### Variables
The `MyReservedWishes` query has no variables.
### Return Type
Recall that executing the `MyReservedWishes` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MyReservedWishesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MyReservedWishesData {
  reservations: ({
    wish: {
      id: UUIDString;
      title: string;
      priceAmount?: number | null;
      priceCurrency?: string | null;
      link?: string | null;
      imageUrl?: string | null;
      owner: {
        uid: string;
        firstName?: string | null;
      } & Profile_Key;
    } & Wish_Key;
  })[];
}
```
### Using `MyReservedWishes`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myReservedWishes } from '@dataconnect/generated';


// Call the `myReservedWishes()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await myReservedWishes();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await myReservedWishes(dataConnect);

console.log(data.reservations);

// Or, you can use the `Promise` API.
myReservedWishes().then((response) => {
  const data = response.data;
  console.log(data.reservations);
});
```

### Using `MyReservedWishes`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, myReservedWishesRef } from '@dataconnect/generated';


// Call the `myReservedWishesRef()` function to get a reference to the query.
const ref = myReservedWishesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = myReservedWishesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.reservations);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.reservations);
});
```

## MyFriendships
You can execute the `MyFriendships` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
myFriendships(options?: ExecuteQueryOptions): QueryPromise<MyFriendshipsData, undefined>;

interface MyFriendshipsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyFriendshipsData, undefined>;
}
export const myFriendshipsRef: MyFriendshipsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
myFriendships(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyFriendshipsData, undefined>;

interface MyFriendshipsRef {
  ...
  (dc: DataConnect): QueryRef<MyFriendshipsData, undefined>;
}
export const myFriendshipsRef: MyFriendshipsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the myFriendshipsRef:
```typescript
const name = myFriendshipsRef.operationName;
console.log(name);
```

### Variables
The `MyFriendships` query has no variables.
### Return Type
Recall that executing the `MyFriendships` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MyFriendshipsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MyFriendshipsData {
  friendships: ({
    createdAt: TimestampString;
    owner: {
      uid: string;
      firstName?: string | null;
      birthdate?: DateString | null;
    } & Profile_Key;
  })[];
}
```
### Using `MyFriendships`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, myFriendships } from '@dataconnect/generated';


// Call the `myFriendships()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await myFriendships();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await myFriendships(dataConnect);

console.log(data.friendships);

// Or, you can use the `Promise` API.
myFriendships().then((response) => {
  const data = response.data;
  console.log(data.friendships);
});
```

### Using `MyFriendships`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, myFriendshipsRef } from '@dataconnect/generated';


// Call the `myFriendshipsRef()` function to get a reference to the query.
const ref = myFriendshipsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = myFriendshipsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.friendships);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.friendships);
});
```

## MySwipes
You can execute the `MySwipes` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
mySwipes(options?: ExecuteQueryOptions): QueryPromise<MySwipesData, undefined>;

interface MySwipesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MySwipesData, undefined>;
}
export const mySwipesRef: MySwipesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
mySwipes(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MySwipesData, undefined>;

interface MySwipesRef {
  ...
  (dc: DataConnect): QueryRef<MySwipesData, undefined>;
}
export const mySwipesRef: MySwipesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the mySwipesRef:
```typescript
const name = mySwipesRef.operationName;
console.log(name);
```

### Variables
The `MySwipes` query has no variables.
### Return Type
Recall that executing the `MySwipes` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MySwipesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MySwipesData {
  giftSwipes: ({
    ideaId: string;
    liked: boolean;
  })[];
}
```
### Using `MySwipes`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, mySwipes } from '@dataconnect/generated';


// Call the `mySwipes()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await mySwipes();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await mySwipes(dataConnect);

console.log(data.giftSwipes);

// Or, you can use the `Promise` API.
mySwipes().then((response) => {
  const data = response.data;
  console.log(data.giftSwipes);
});
```

### Using `MySwipes`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, mySwipesRef } from '@dataconnect/generated';


// Call the `mySwipesRef()` function to get a reference to the query.
const ref = mySwipesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = mySwipesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.giftSwipes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.giftSwipes);
});
```

## IdeasByInterests
You can execute the `IdeasByInterests` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
ideasByInterests(vars: IdeasByInterestsVariables, options?: ExecuteQueryOptions): QueryPromise<IdeasByInterestsData, IdeasByInterestsVariables>;

interface IdeasByInterestsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: IdeasByInterestsVariables): QueryRef<IdeasByInterestsData, IdeasByInterestsVariables>;
}
export const ideasByInterestsRef: IdeasByInterestsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
ideasByInterests(dc: DataConnect, vars: IdeasByInterestsVariables, options?: ExecuteQueryOptions): QueryPromise<IdeasByInterestsData, IdeasByInterestsVariables>;

interface IdeasByInterestsRef {
  ...
  (dc: DataConnect, vars: IdeasByInterestsVariables): QueryRef<IdeasByInterestsData, IdeasByInterestsVariables>;
}
export const ideasByInterestsRef: IdeasByInterestsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the ideasByInterestsRef:
```typescript
const name = ideasByInterestsRef.operationName;
console.log(name);
```

### Variables
The `IdeasByInterests` query requires an argument of type `IdeasByInterestsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface IdeasByInterestsVariables {
  interests: string[];
  limit?: number | null;
}
```
### Return Type
Recall that executing the `IdeasByInterests` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `IdeasByInterestsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface IdeasByInterestsData {
  wishes: ({
    id: UUIDString;
    title: string;
    priceAmount?: number | null;
    priceCurrency?: string | null;
    link?: string | null;
    imageUrl?: string | null;
    interests: ({
      interest: {
        name: string;
      } & Interest_Key;
    })[];
  } & Wish_Key)[];
}
```
### Using `IdeasByInterests`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ideasByInterests, IdeasByInterestsVariables } from '@dataconnect/generated';

// The `IdeasByInterests` query requires an argument of type `IdeasByInterestsVariables`:
const ideasByInterestsVars: IdeasByInterestsVariables = {
  interests: ..., 
  limit: ..., // optional
};

// Call the `ideasByInterests()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await ideasByInterests(ideasByInterestsVars);
// Variables can be defined inline as well.
const { data } = await ideasByInterests({ interests: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await ideasByInterests(dataConnect, ideasByInterestsVars);

console.log(data.wishes);

// Or, you can use the `Promise` API.
ideasByInterests(ideasByInterestsVars).then((response) => {
  const data = response.data;
  console.log(data.wishes);
});
```

### Using `IdeasByInterests`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, ideasByInterestsRef, IdeasByInterestsVariables } from '@dataconnect/generated';

// The `IdeasByInterests` query requires an argument of type `IdeasByInterestsVariables`:
const ideasByInterestsVars: IdeasByInterestsVariables = {
  interests: ..., 
  limit: ..., // optional
};

// Call the `ideasByInterestsRef()` function to get a reference to the query.
const ref = ideasByInterestsRef(ideasByInterestsVars);
// Variables can be defined inline as well.
const ref = ideasByInterestsRef({ interests: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = ideasByInterestsRef(dataConnect, ideasByInterestsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.wishes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.wishes);
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

Below are examples of how to use the `wishlly` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## UpsertMyProfile
You can execute the `UpsertMyProfile` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertMyProfile(vars?: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;

interface UpsertMyProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
}
export const upsertMyProfileRef: UpsertMyProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertMyProfile(dc: DataConnect, vars?: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;

interface UpsertMyProfileRef {
  ...
  (dc: DataConnect, vars?: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
}
export const upsertMyProfileRef: UpsertMyProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertMyProfileRef:
```typescript
const name = upsertMyProfileRef.operationName;
console.log(name);
```

### Variables
The `UpsertMyProfile` mutation has an optional argument of type `UpsertMyProfileVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertMyProfileVariables {
  firstName?: string | null;
  birthdate?: DateString | null;
  gender?: string | null;
  onboardingCompleted?: boolean;
}
```
### Return Type
Recall that executing the `UpsertMyProfile` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertMyProfileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertMyProfileData {
  profile_upsert: Profile_Key;
}
```
### Using `UpsertMyProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertMyProfile, UpsertMyProfileVariables } from '@dataconnect/generated';

// The `UpsertMyProfile` mutation has an optional argument of type `UpsertMyProfileVariables`:
const upsertMyProfileVars: UpsertMyProfileVariables = {
  firstName: ..., // optional
  birthdate: ..., // optional
  gender: ..., // optional
  onboardingCompleted: ..., // optional
};

// Call the `upsertMyProfile()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertMyProfile(upsertMyProfileVars);
// Variables can be defined inline as well.
const { data } = await upsertMyProfile({ firstName: ..., birthdate: ..., gender: ..., onboardingCompleted: ..., });
// Since all variables are optional for this mutation, you can omit the `UpsertMyProfileVariables` argument.
const { data } = await upsertMyProfile();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertMyProfile(dataConnect, upsertMyProfileVars);

console.log(data.profile_upsert);

// Or, you can use the `Promise` API.
upsertMyProfile(upsertMyProfileVars).then((response) => {
  const data = response.data;
  console.log(data.profile_upsert);
});
```

### Using `UpsertMyProfile`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertMyProfileRef, UpsertMyProfileVariables } from '@dataconnect/generated';

// The `UpsertMyProfile` mutation has an optional argument of type `UpsertMyProfileVariables`:
const upsertMyProfileVars: UpsertMyProfileVariables = {
  firstName: ..., // optional
  birthdate: ..., // optional
  gender: ..., // optional
  onboardingCompleted: ..., // optional
};

// Call the `upsertMyProfileRef()` function to get a reference to the mutation.
const ref = upsertMyProfileRef(upsertMyProfileVars);
// Variables can be defined inline as well.
const ref = upsertMyProfileRef({ firstName: ..., birthdate: ..., gender: ..., onboardingCompleted: ..., });
// Since all variables are optional for this mutation, you can omit the `UpsertMyProfileVariables` argument.
const ref = upsertMyProfileRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertMyProfileRef(dataConnect, upsertMyProfileVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.profile_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.profile_upsert);
});
```

## AddMyInterest
You can execute the `AddMyInterest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addMyInterest(vars: AddMyInterestVariables): MutationPromise<AddMyInterestData, AddMyInterestVariables>;

interface AddMyInterestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddMyInterestVariables): MutationRef<AddMyInterestData, AddMyInterestVariables>;
}
export const addMyInterestRef: AddMyInterestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addMyInterest(dc: DataConnect, vars: AddMyInterestVariables): MutationPromise<AddMyInterestData, AddMyInterestVariables>;

interface AddMyInterestRef {
  ...
  (dc: DataConnect, vars: AddMyInterestVariables): MutationRef<AddMyInterestData, AddMyInterestVariables>;
}
export const addMyInterestRef: AddMyInterestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addMyInterestRef:
```typescript
const name = addMyInterestRef.operationName;
console.log(name);
```

### Variables
The `AddMyInterest` mutation requires an argument of type `AddMyInterestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddMyInterestVariables {
  name: string;
}
```
### Return Type
Recall that executing the `AddMyInterest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddMyInterestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddMyInterestData {
  interest_upsert: Interest_Key;
  profileInterest_upsert: ProfileInterest_Key;
}
```
### Using `AddMyInterest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addMyInterest, AddMyInterestVariables } from '@dataconnect/generated';

// The `AddMyInterest` mutation requires an argument of type `AddMyInterestVariables`:
const addMyInterestVars: AddMyInterestVariables = {
  name: ..., 
};

// Call the `addMyInterest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addMyInterest(addMyInterestVars);
// Variables can be defined inline as well.
const { data } = await addMyInterest({ name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addMyInterest(dataConnect, addMyInterestVars);

console.log(data.interest_upsert);
console.log(data.profileInterest_upsert);

// Or, you can use the `Promise` API.
addMyInterest(addMyInterestVars).then((response) => {
  const data = response.data;
  console.log(data.interest_upsert);
  console.log(data.profileInterest_upsert);
});
```

### Using `AddMyInterest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addMyInterestRef, AddMyInterestVariables } from '@dataconnect/generated';

// The `AddMyInterest` mutation requires an argument of type `AddMyInterestVariables`:
const addMyInterestVars: AddMyInterestVariables = {
  name: ..., 
};

// Call the `addMyInterestRef()` function to get a reference to the mutation.
const ref = addMyInterestRef(addMyInterestVars);
// Variables can be defined inline as well.
const ref = addMyInterestRef({ name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addMyInterestRef(dataConnect, addMyInterestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.interest_upsert);
console.log(data.profileInterest_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.interest_upsert);
  console.log(data.profileInterest_upsert);
});
```

## RemoveMyInterest
You can execute the `RemoveMyInterest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeMyInterest(vars: RemoveMyInterestVariables): MutationPromise<RemoveMyInterestData, RemoveMyInterestVariables>;

interface RemoveMyInterestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveMyInterestVariables): MutationRef<RemoveMyInterestData, RemoveMyInterestVariables>;
}
export const removeMyInterestRef: RemoveMyInterestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeMyInterest(dc: DataConnect, vars: RemoveMyInterestVariables): MutationPromise<RemoveMyInterestData, RemoveMyInterestVariables>;

interface RemoveMyInterestRef {
  ...
  (dc: DataConnect, vars: RemoveMyInterestVariables): MutationRef<RemoveMyInterestData, RemoveMyInterestVariables>;
}
export const removeMyInterestRef: RemoveMyInterestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeMyInterestRef:
```typescript
const name = removeMyInterestRef.operationName;
console.log(name);
```

### Variables
The `RemoveMyInterest` mutation requires an argument of type `RemoveMyInterestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveMyInterestVariables {
  name: string;
}
```
### Return Type
Recall that executing the `RemoveMyInterest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveMyInterestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveMyInterestData {
  profileInterest_delete?: ProfileInterest_Key | null;
}
```
### Using `RemoveMyInterest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeMyInterest, RemoveMyInterestVariables } from '@dataconnect/generated';

// The `RemoveMyInterest` mutation requires an argument of type `RemoveMyInterestVariables`:
const removeMyInterestVars: RemoveMyInterestVariables = {
  name: ..., 
};

// Call the `removeMyInterest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeMyInterest(removeMyInterestVars);
// Variables can be defined inline as well.
const { data } = await removeMyInterest({ name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeMyInterest(dataConnect, removeMyInterestVars);

console.log(data.profileInterest_delete);

// Or, you can use the `Promise` API.
removeMyInterest(removeMyInterestVars).then((response) => {
  const data = response.data;
  console.log(data.profileInterest_delete);
});
```

### Using `RemoveMyInterest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeMyInterestRef, RemoveMyInterestVariables } from '@dataconnect/generated';

// The `RemoveMyInterest` mutation requires an argument of type `RemoveMyInterestVariables`:
const removeMyInterestVars: RemoveMyInterestVariables = {
  name: ..., 
};

// Call the `removeMyInterestRef()` function to get a reference to the mutation.
const ref = removeMyInterestRef(removeMyInterestVars);
// Variables can be defined inline as well.
const ref = removeMyInterestRef({ name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeMyInterestRef(dataConnect, removeMyInterestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.profileInterest_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.profileInterest_delete);
});
```

## CreateGroup
You can execute the `CreateGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createGroup(vars: CreateGroupVariables): MutationPromise<CreateGroupData, CreateGroupVariables>;

interface CreateGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGroupVariables): MutationRef<CreateGroupData, CreateGroupVariables>;
}
export const createGroupRef: CreateGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createGroup(dc: DataConnect, vars: CreateGroupVariables): MutationPromise<CreateGroupData, CreateGroupVariables>;

interface CreateGroupRef {
  ...
  (dc: DataConnect, vars: CreateGroupVariables): MutationRef<CreateGroupData, CreateGroupVariables>;
}
export const createGroupRef: CreateGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createGroupRef:
```typescript
const name = createGroupRef.operationName;
console.log(name);
```

### Variables
The `CreateGroup` mutation requires an argument of type `CreateGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateGroupVariables {
  name: string;
}
```
### Return Type
Recall that executing the `CreateGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateGroupData {
  group_insert: Group_Key;
}
```
### Using `CreateGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createGroup, CreateGroupVariables } from '@dataconnect/generated';

// The `CreateGroup` mutation requires an argument of type `CreateGroupVariables`:
const createGroupVars: CreateGroupVariables = {
  name: ..., 
};

// Call the `createGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createGroup(createGroupVars);
// Variables can be defined inline as well.
const { data } = await createGroup({ name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createGroup(dataConnect, createGroupVars);

console.log(data.group_insert);

// Or, you can use the `Promise` API.
createGroup(createGroupVars).then((response) => {
  const data = response.data;
  console.log(data.group_insert);
});
```

### Using `CreateGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createGroupRef, CreateGroupVariables } from '@dataconnect/generated';

// The `CreateGroup` mutation requires an argument of type `CreateGroupVariables`:
const createGroupVars: CreateGroupVariables = {
  name: ..., 
};

// Call the `createGroupRef()` function to get a reference to the mutation.
const ref = createGroupRef(createGroupVars);
// Variables can be defined inline as well.
const ref = createGroupRef({ name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createGroupRef(dataConnect, createGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.group_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.group_insert);
});
```

## RenameGroup
You can execute the `RenameGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
renameGroup(vars: RenameGroupVariables): MutationPromise<RenameGroupData, RenameGroupVariables>;

interface RenameGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RenameGroupVariables): MutationRef<RenameGroupData, RenameGroupVariables>;
}
export const renameGroupRef: RenameGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
renameGroup(dc: DataConnect, vars: RenameGroupVariables): MutationPromise<RenameGroupData, RenameGroupVariables>;

interface RenameGroupRef {
  ...
  (dc: DataConnect, vars: RenameGroupVariables): MutationRef<RenameGroupData, RenameGroupVariables>;
}
export const renameGroupRef: RenameGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the renameGroupRef:
```typescript
const name = renameGroupRef.operationName;
console.log(name);
```

### Variables
The `RenameGroup` mutation requires an argument of type `RenameGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RenameGroupVariables {
  id: UUIDString;
  name: string;
}
```
### Return Type
Recall that executing the `RenameGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RenameGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RenameGroupData {
  group_updateMany: number;
}
```
### Using `RenameGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, renameGroup, RenameGroupVariables } from '@dataconnect/generated';

// The `RenameGroup` mutation requires an argument of type `RenameGroupVariables`:
const renameGroupVars: RenameGroupVariables = {
  id: ..., 
  name: ..., 
};

// Call the `renameGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await renameGroup(renameGroupVars);
// Variables can be defined inline as well.
const { data } = await renameGroup({ id: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await renameGroup(dataConnect, renameGroupVars);

console.log(data.group_updateMany);

// Or, you can use the `Promise` API.
renameGroup(renameGroupVars).then((response) => {
  const data = response.data;
  console.log(data.group_updateMany);
});
```

### Using `RenameGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, renameGroupRef, RenameGroupVariables } from '@dataconnect/generated';

// The `RenameGroup` mutation requires an argument of type `RenameGroupVariables`:
const renameGroupVars: RenameGroupVariables = {
  id: ..., 
  name: ..., 
};

// Call the `renameGroupRef()` function to get a reference to the mutation.
const ref = renameGroupRef(renameGroupVars);
// Variables can be defined inline as well.
const ref = renameGroupRef({ id: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = renameGroupRef(dataConnect, renameGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.group_updateMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.group_updateMany);
});
```

## DeleteGroup
You can execute the `DeleteGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteGroup(vars: DeleteGroupVariables): MutationPromise<DeleteGroupData, DeleteGroupVariables>;

interface DeleteGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGroupVariables): MutationRef<DeleteGroupData, DeleteGroupVariables>;
}
export const deleteGroupRef: DeleteGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteGroup(dc: DataConnect, vars: DeleteGroupVariables): MutationPromise<DeleteGroupData, DeleteGroupVariables>;

interface DeleteGroupRef {
  ...
  (dc: DataConnect, vars: DeleteGroupVariables): MutationRef<DeleteGroupData, DeleteGroupVariables>;
}
export const deleteGroupRef: DeleteGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteGroupRef:
```typescript
const name = deleteGroupRef.operationName;
console.log(name);
```

### Variables
The `DeleteGroup` mutation requires an argument of type `DeleteGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteGroupVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteGroupData {
  wish_updateMany: number;
  group_deleteMany: number;
}
```
### Using `DeleteGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteGroup, DeleteGroupVariables } from '@dataconnect/generated';

// The `DeleteGroup` mutation requires an argument of type `DeleteGroupVariables`:
const deleteGroupVars: DeleteGroupVariables = {
  id: ..., 
};

// Call the `deleteGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteGroup(deleteGroupVars);
// Variables can be defined inline as well.
const { data } = await deleteGroup({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteGroup(dataConnect, deleteGroupVars);

console.log(data.wish_updateMany);
console.log(data.group_deleteMany);

// Or, you can use the `Promise` API.
deleteGroup(deleteGroupVars).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
  console.log(data.group_deleteMany);
});
```

### Using `DeleteGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteGroupRef, DeleteGroupVariables } from '@dataconnect/generated';

// The `DeleteGroup` mutation requires an argument of type `DeleteGroupVariables`:
const deleteGroupVars: DeleteGroupVariables = {
  id: ..., 
};

// Call the `deleteGroupRef()` function to get a reference to the mutation.
const ref = deleteGroupRef(deleteGroupVars);
// Variables can be defined inline as well.
const ref = deleteGroupRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteGroupRef(dataConnect, deleteGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wish_updateMany);
console.log(data.group_deleteMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
  console.log(data.group_deleteMany);
});
```

## CreateWish
You can execute the `CreateWish` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createWish(vars: CreateWishVariables): MutationPromise<CreateWishData, CreateWishVariables>;

interface CreateWishRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWishVariables): MutationRef<CreateWishData, CreateWishVariables>;
}
export const createWishRef: CreateWishRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createWish(dc: DataConnect, vars: CreateWishVariables): MutationPromise<CreateWishData, CreateWishVariables>;

interface CreateWishRef {
  ...
  (dc: DataConnect, vars: CreateWishVariables): MutationRef<CreateWishData, CreateWishVariables>;
}
export const createWishRef: CreateWishRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createWishRef:
```typescript
const name = createWishRef.operationName;
console.log(name);
```

### Variables
The `CreateWish` mutation requires an argument of type `CreateWishVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateWishVariables {
  title: string;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  note?: string | null;
  shareToIdeas?: boolean;
}
```
### Return Type
Recall that executing the `CreateWish` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateWishData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateWishData {
  wish_insert: Wish_Key;
}
```
### Using `CreateWish`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createWish, CreateWishVariables } from '@dataconnect/generated';

// The `CreateWish` mutation requires an argument of type `CreateWishVariables`:
const createWishVars: CreateWishVariables = {
  title: ..., 
  priceAmount: ..., // optional
  priceCurrency: ..., // optional
  link: ..., // optional
  imageUrl: ..., // optional
  note: ..., // optional
  shareToIdeas: ..., // optional
};

// Call the `createWish()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createWish(createWishVars);
// Variables can be defined inline as well.
const { data } = await createWish({ title: ..., priceAmount: ..., priceCurrency: ..., link: ..., imageUrl: ..., note: ..., shareToIdeas: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createWish(dataConnect, createWishVars);

console.log(data.wish_insert);

// Or, you can use the `Promise` API.
createWish(createWishVars).then((response) => {
  const data = response.data;
  console.log(data.wish_insert);
});
```

### Using `CreateWish`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createWishRef, CreateWishVariables } from '@dataconnect/generated';

// The `CreateWish` mutation requires an argument of type `CreateWishVariables`:
const createWishVars: CreateWishVariables = {
  title: ..., 
  priceAmount: ..., // optional
  priceCurrency: ..., // optional
  link: ..., // optional
  imageUrl: ..., // optional
  note: ..., // optional
  shareToIdeas: ..., // optional
};

// Call the `createWishRef()` function to get a reference to the mutation.
const ref = createWishRef(createWishVars);
// Variables can be defined inline as well.
const ref = createWishRef({ title: ..., priceAmount: ..., priceCurrency: ..., link: ..., imageUrl: ..., note: ..., shareToIdeas: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createWishRef(dataConnect, createWishVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wish_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wish_insert);
});
```

## CreateWishInGroup
You can execute the `CreateWishInGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createWishInGroup(vars: CreateWishInGroupVariables): MutationPromise<CreateWishInGroupData, CreateWishInGroupVariables>;

interface CreateWishInGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWishInGroupVariables): MutationRef<CreateWishInGroupData, CreateWishInGroupVariables>;
}
export const createWishInGroupRef: CreateWishInGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createWishInGroup(dc: DataConnect, vars: CreateWishInGroupVariables): MutationPromise<CreateWishInGroupData, CreateWishInGroupVariables>;

interface CreateWishInGroupRef {
  ...
  (dc: DataConnect, vars: CreateWishInGroupVariables): MutationRef<CreateWishInGroupData, CreateWishInGroupVariables>;
}
export const createWishInGroupRef: CreateWishInGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createWishInGroupRef:
```typescript
const name = createWishInGroupRef.operationName;
console.log(name);
```

### Variables
The `CreateWishInGroup` mutation requires an argument of type `CreateWishInGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateWishInGroupVariables {
  groupId: UUIDString;
  title: string;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  note?: string | null;
  shareToIdeas?: boolean;
}
```
### Return Type
Recall that executing the `CreateWishInGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateWishInGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateWishInGroupData {
  wish_insert: Wish_Key;
}
```
### Using `CreateWishInGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createWishInGroup, CreateWishInGroupVariables } from '@dataconnect/generated';

// The `CreateWishInGroup` mutation requires an argument of type `CreateWishInGroupVariables`:
const createWishInGroupVars: CreateWishInGroupVariables = {
  groupId: ..., 
  title: ..., 
  priceAmount: ..., // optional
  priceCurrency: ..., // optional
  link: ..., // optional
  imageUrl: ..., // optional
  note: ..., // optional
  shareToIdeas: ..., // optional
};

// Call the `createWishInGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createWishInGroup(createWishInGroupVars);
// Variables can be defined inline as well.
const { data } = await createWishInGroup({ groupId: ..., title: ..., priceAmount: ..., priceCurrency: ..., link: ..., imageUrl: ..., note: ..., shareToIdeas: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createWishInGroup(dataConnect, createWishInGroupVars);

console.log(data.wish_insert);

// Or, you can use the `Promise` API.
createWishInGroup(createWishInGroupVars).then((response) => {
  const data = response.data;
  console.log(data.wish_insert);
});
```

### Using `CreateWishInGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createWishInGroupRef, CreateWishInGroupVariables } from '@dataconnect/generated';

// The `CreateWishInGroup` mutation requires an argument of type `CreateWishInGroupVariables`:
const createWishInGroupVars: CreateWishInGroupVariables = {
  groupId: ..., 
  title: ..., 
  priceAmount: ..., // optional
  priceCurrency: ..., // optional
  link: ..., // optional
  imageUrl: ..., // optional
  note: ..., // optional
  shareToIdeas: ..., // optional
};

// Call the `createWishInGroupRef()` function to get a reference to the mutation.
const ref = createWishInGroupRef(createWishInGroupVars);
// Variables can be defined inline as well.
const ref = createWishInGroupRef({ groupId: ..., title: ..., priceAmount: ..., priceCurrency: ..., link: ..., imageUrl: ..., note: ..., shareToIdeas: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createWishInGroupRef(dataConnect, createWishInGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wish_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wish_insert);
});
```

## UpdateWish
You can execute the `UpdateWish` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateWish(vars: UpdateWishVariables): MutationPromise<UpdateWishData, UpdateWishVariables>;

interface UpdateWishRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateWishVariables): MutationRef<UpdateWishData, UpdateWishVariables>;
}
export const updateWishRef: UpdateWishRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateWish(dc: DataConnect, vars: UpdateWishVariables): MutationPromise<UpdateWishData, UpdateWishVariables>;

interface UpdateWishRef {
  ...
  (dc: DataConnect, vars: UpdateWishVariables): MutationRef<UpdateWishData, UpdateWishVariables>;
}
export const updateWishRef: UpdateWishRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateWishRef:
```typescript
const name = updateWishRef.operationName;
console.log(name);
```

### Variables
The `UpdateWish` mutation requires an argument of type `UpdateWishVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateWishVariables {
  id: UUIDString;
  title: string;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  note?: string | null;
  shareToIdeas?: boolean;
}
```
### Return Type
Recall that executing the `UpdateWish` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateWishData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateWishData {
  wish_updateMany: number;
}
```
### Using `UpdateWish`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateWish, UpdateWishVariables } from '@dataconnect/generated';

// The `UpdateWish` mutation requires an argument of type `UpdateWishVariables`:
const updateWishVars: UpdateWishVariables = {
  id: ..., 
  title: ..., 
  priceAmount: ..., // optional
  priceCurrency: ..., // optional
  link: ..., // optional
  imageUrl: ..., // optional
  note: ..., // optional
  shareToIdeas: ..., // optional
};

// Call the `updateWish()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateWish(updateWishVars);
// Variables can be defined inline as well.
const { data } = await updateWish({ id: ..., title: ..., priceAmount: ..., priceCurrency: ..., link: ..., imageUrl: ..., note: ..., shareToIdeas: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateWish(dataConnect, updateWishVars);

console.log(data.wish_updateMany);

// Or, you can use the `Promise` API.
updateWish(updateWishVars).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
});
```

### Using `UpdateWish`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateWishRef, UpdateWishVariables } from '@dataconnect/generated';

// The `UpdateWish` mutation requires an argument of type `UpdateWishVariables`:
const updateWishVars: UpdateWishVariables = {
  id: ..., 
  title: ..., 
  priceAmount: ..., // optional
  priceCurrency: ..., // optional
  link: ..., // optional
  imageUrl: ..., // optional
  note: ..., // optional
  shareToIdeas: ..., // optional
};

// Call the `updateWishRef()` function to get a reference to the mutation.
const ref = updateWishRef(updateWishVars);
// Variables can be defined inline as well.
const ref = updateWishRef({ id: ..., title: ..., priceAmount: ..., priceCurrency: ..., link: ..., imageUrl: ..., note: ..., shareToIdeas: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateWishRef(dataConnect, updateWishVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wish_updateMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
});
```

## MoveWishToGroup
You can execute the `MoveWishToGroup` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
moveWishToGroup(vars: MoveWishToGroupVariables): MutationPromise<MoveWishToGroupData, MoveWishToGroupVariables>;

interface MoveWishToGroupRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MoveWishToGroupVariables): MutationRef<MoveWishToGroupData, MoveWishToGroupVariables>;
}
export const moveWishToGroupRef: MoveWishToGroupRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
moveWishToGroup(dc: DataConnect, vars: MoveWishToGroupVariables): MutationPromise<MoveWishToGroupData, MoveWishToGroupVariables>;

interface MoveWishToGroupRef {
  ...
  (dc: DataConnect, vars: MoveWishToGroupVariables): MutationRef<MoveWishToGroupData, MoveWishToGroupVariables>;
}
export const moveWishToGroupRef: MoveWishToGroupRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the moveWishToGroupRef:
```typescript
const name = moveWishToGroupRef.operationName;
console.log(name);
```

### Variables
The `MoveWishToGroup` mutation requires an argument of type `MoveWishToGroupVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MoveWishToGroupVariables {
  id: UUIDString;
  groupId: UUIDString;
}
```
### Return Type
Recall that executing the `MoveWishToGroup` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MoveWishToGroupData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MoveWishToGroupData {
  wish_updateMany: number;
}
```
### Using `MoveWishToGroup`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, moveWishToGroup, MoveWishToGroupVariables } from '@dataconnect/generated';

// The `MoveWishToGroup` mutation requires an argument of type `MoveWishToGroupVariables`:
const moveWishToGroupVars: MoveWishToGroupVariables = {
  id: ..., 
  groupId: ..., 
};

// Call the `moveWishToGroup()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await moveWishToGroup(moveWishToGroupVars);
// Variables can be defined inline as well.
const { data } = await moveWishToGroup({ id: ..., groupId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await moveWishToGroup(dataConnect, moveWishToGroupVars);

console.log(data.wish_updateMany);

// Or, you can use the `Promise` API.
moveWishToGroup(moveWishToGroupVars).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
});
```

### Using `MoveWishToGroup`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, moveWishToGroupRef, MoveWishToGroupVariables } from '@dataconnect/generated';

// The `MoveWishToGroup` mutation requires an argument of type `MoveWishToGroupVariables`:
const moveWishToGroupVars: MoveWishToGroupVariables = {
  id: ..., 
  groupId: ..., 
};

// Call the `moveWishToGroupRef()` function to get a reference to the mutation.
const ref = moveWishToGroupRef(moveWishToGroupVars);
// Variables can be defined inline as well.
const ref = moveWishToGroupRef({ id: ..., groupId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = moveWishToGroupRef(dataConnect, moveWishToGroupVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wish_updateMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
});
```

## UngroupWish
You can execute the `UngroupWish` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
ungroupWish(vars: UngroupWishVariables): MutationPromise<UngroupWishData, UngroupWishVariables>;

interface UngroupWishRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UngroupWishVariables): MutationRef<UngroupWishData, UngroupWishVariables>;
}
export const ungroupWishRef: UngroupWishRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
ungroupWish(dc: DataConnect, vars: UngroupWishVariables): MutationPromise<UngroupWishData, UngroupWishVariables>;

interface UngroupWishRef {
  ...
  (dc: DataConnect, vars: UngroupWishVariables): MutationRef<UngroupWishData, UngroupWishVariables>;
}
export const ungroupWishRef: UngroupWishRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the ungroupWishRef:
```typescript
const name = ungroupWishRef.operationName;
console.log(name);
```

### Variables
The `UngroupWish` mutation requires an argument of type `UngroupWishVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UngroupWishVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `UngroupWish` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UngroupWishData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UngroupWishData {
  wish_updateMany: number;
}
```
### Using `UngroupWish`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, ungroupWish, UngroupWishVariables } from '@dataconnect/generated';

// The `UngroupWish` mutation requires an argument of type `UngroupWishVariables`:
const ungroupWishVars: UngroupWishVariables = {
  id: ..., 
};

// Call the `ungroupWish()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await ungroupWish(ungroupWishVars);
// Variables can be defined inline as well.
const { data } = await ungroupWish({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await ungroupWish(dataConnect, ungroupWishVars);

console.log(data.wish_updateMany);

// Or, you can use the `Promise` API.
ungroupWish(ungroupWishVars).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
});
```

### Using `UngroupWish`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, ungroupWishRef, UngroupWishVariables } from '@dataconnect/generated';

// The `UngroupWish` mutation requires an argument of type `UngroupWishVariables`:
const ungroupWishVars: UngroupWishVariables = {
  id: ..., 
};

// Call the `ungroupWishRef()` function to get a reference to the mutation.
const ref = ungroupWishRef(ungroupWishVars);
// Variables can be defined inline as well.
const ref = ungroupWishRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = ungroupWishRef(dataConnect, ungroupWishVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wish_updateMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wish_updateMany);
});
```

## DeleteWish
You can execute the `DeleteWish` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteWish(vars: DeleteWishVariables): MutationPromise<DeleteWishData, DeleteWishVariables>;

interface DeleteWishRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteWishVariables): MutationRef<DeleteWishData, DeleteWishVariables>;
}
export const deleteWishRef: DeleteWishRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteWish(dc: DataConnect, vars: DeleteWishVariables): MutationPromise<DeleteWishData, DeleteWishVariables>;

interface DeleteWishRef {
  ...
  (dc: DataConnect, vars: DeleteWishVariables): MutationRef<DeleteWishData, DeleteWishVariables>;
}
export const deleteWishRef: DeleteWishRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteWishRef:
```typescript
const name = deleteWishRef.operationName;
console.log(name);
```

### Variables
The `DeleteWish` mutation requires an argument of type `DeleteWishVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteWishVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteWish` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteWishData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteWishData {
  wish_deleteMany: number;
}
```
### Using `DeleteWish`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteWish, DeleteWishVariables } from '@dataconnect/generated';

// The `DeleteWish` mutation requires an argument of type `DeleteWishVariables`:
const deleteWishVars: DeleteWishVariables = {
  id: ..., 
};

// Call the `deleteWish()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteWish(deleteWishVars);
// Variables can be defined inline as well.
const { data } = await deleteWish({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteWish(dataConnect, deleteWishVars);

console.log(data.wish_deleteMany);

// Or, you can use the `Promise` API.
deleteWish(deleteWishVars).then((response) => {
  const data = response.data;
  console.log(data.wish_deleteMany);
});
```

### Using `DeleteWish`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteWishRef, DeleteWishVariables } from '@dataconnect/generated';

// The `DeleteWish` mutation requires an argument of type `DeleteWishVariables`:
const deleteWishVars: DeleteWishVariables = {
  id: ..., 
};

// Call the `deleteWishRef()` function to get a reference to the mutation.
const ref = deleteWishRef(deleteWishVars);
// Variables can be defined inline as well.
const ref = deleteWishRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteWishRef(dataConnect, deleteWishVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wish_deleteMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wish_deleteMany);
});
```

## AddWishInterest
You can execute the `AddWishInterest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addWishInterest(vars: AddWishInterestVariables): MutationPromise<AddWishInterestData, AddWishInterestVariables>;

interface AddWishInterestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddWishInterestVariables): MutationRef<AddWishInterestData, AddWishInterestVariables>;
}
export const addWishInterestRef: AddWishInterestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addWishInterest(dc: DataConnect, vars: AddWishInterestVariables): MutationPromise<AddWishInterestData, AddWishInterestVariables>;

interface AddWishInterestRef {
  ...
  (dc: DataConnect, vars: AddWishInterestVariables): MutationRef<AddWishInterestData, AddWishInterestVariables>;
}
export const addWishInterestRef: AddWishInterestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addWishInterestRef:
```typescript
const name = addWishInterestRef.operationName;
console.log(name);
```

### Variables
The `AddWishInterest` mutation requires an argument of type `AddWishInterestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddWishInterestVariables {
  wishId: UUIDString;
  name: string;
}
```
### Return Type
Recall that executing the `AddWishInterest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddWishInterestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddWishInterestData {
  interest_upsert: Interest_Key;
  wishInterest_upsert: WishInterest_Key;
}
```
### Using `AddWishInterest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addWishInterest, AddWishInterestVariables } from '@dataconnect/generated';

// The `AddWishInterest` mutation requires an argument of type `AddWishInterestVariables`:
const addWishInterestVars: AddWishInterestVariables = {
  wishId: ..., 
  name: ..., 
};

// Call the `addWishInterest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addWishInterest(addWishInterestVars);
// Variables can be defined inline as well.
const { data } = await addWishInterest({ wishId: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addWishInterest(dataConnect, addWishInterestVars);

console.log(data.interest_upsert);
console.log(data.wishInterest_upsert);

// Or, you can use the `Promise` API.
addWishInterest(addWishInterestVars).then((response) => {
  const data = response.data;
  console.log(data.interest_upsert);
  console.log(data.wishInterest_upsert);
});
```

### Using `AddWishInterest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addWishInterestRef, AddWishInterestVariables } from '@dataconnect/generated';

// The `AddWishInterest` mutation requires an argument of type `AddWishInterestVariables`:
const addWishInterestVars: AddWishInterestVariables = {
  wishId: ..., 
  name: ..., 
};

// Call the `addWishInterestRef()` function to get a reference to the mutation.
const ref = addWishInterestRef(addWishInterestVars);
// Variables can be defined inline as well.
const ref = addWishInterestRef({ wishId: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addWishInterestRef(dataConnect, addWishInterestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.interest_upsert);
console.log(data.wishInterest_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.interest_upsert);
  console.log(data.wishInterest_upsert);
});
```

## RemoveWishInterest
You can execute the `RemoveWishInterest` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeWishInterest(vars: RemoveWishInterestVariables): MutationPromise<RemoveWishInterestData, RemoveWishInterestVariables>;

interface RemoveWishInterestRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveWishInterestVariables): MutationRef<RemoveWishInterestData, RemoveWishInterestVariables>;
}
export const removeWishInterestRef: RemoveWishInterestRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeWishInterest(dc: DataConnect, vars: RemoveWishInterestVariables): MutationPromise<RemoveWishInterestData, RemoveWishInterestVariables>;

interface RemoveWishInterestRef {
  ...
  (dc: DataConnect, vars: RemoveWishInterestVariables): MutationRef<RemoveWishInterestData, RemoveWishInterestVariables>;
}
export const removeWishInterestRef: RemoveWishInterestRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeWishInterestRef:
```typescript
const name = removeWishInterestRef.operationName;
console.log(name);
```

### Variables
The `RemoveWishInterest` mutation requires an argument of type `RemoveWishInterestVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveWishInterestVariables {
  wishId: UUIDString;
  name: string;
}
```
### Return Type
Recall that executing the `RemoveWishInterest` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveWishInterestData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveWishInterestData {
  wishInterest_deleteMany: number;
}
```
### Using `RemoveWishInterest`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeWishInterest, RemoveWishInterestVariables } from '@dataconnect/generated';

// The `RemoveWishInterest` mutation requires an argument of type `RemoveWishInterestVariables`:
const removeWishInterestVars: RemoveWishInterestVariables = {
  wishId: ..., 
  name: ..., 
};

// Call the `removeWishInterest()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeWishInterest(removeWishInterestVars);
// Variables can be defined inline as well.
const { data } = await removeWishInterest({ wishId: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeWishInterest(dataConnect, removeWishInterestVars);

console.log(data.wishInterest_deleteMany);

// Or, you can use the `Promise` API.
removeWishInterest(removeWishInterestVars).then((response) => {
  const data = response.data;
  console.log(data.wishInterest_deleteMany);
});
```

### Using `RemoveWishInterest`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeWishInterestRef, RemoveWishInterestVariables } from '@dataconnect/generated';

// The `RemoveWishInterest` mutation requires an argument of type `RemoveWishInterestVariables`:
const removeWishInterestVars: RemoveWishInterestVariables = {
  wishId: ..., 
  name: ..., 
};

// Call the `removeWishInterestRef()` function to get a reference to the mutation.
const ref = removeWishInterestRef(removeWishInterestVars);
// Variables can be defined inline as well.
const ref = removeWishInterestRef({ wishId: ..., name: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeWishInterestRef(dataConnect, removeWishInterestVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.wishInterest_deleteMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.wishInterest_deleteMany);
});
```

## ReserveWish
You can execute the `ReserveWish` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
reserveWish(vars: ReserveWishVariables): MutationPromise<ReserveWishData, ReserveWishVariables>;

interface ReserveWishRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveWishVariables): MutationRef<ReserveWishData, ReserveWishVariables>;
}
export const reserveWishRef: ReserveWishRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reserveWish(dc: DataConnect, vars: ReserveWishVariables): MutationPromise<ReserveWishData, ReserveWishVariables>;

interface ReserveWishRef {
  ...
  (dc: DataConnect, vars: ReserveWishVariables): MutationRef<ReserveWishData, ReserveWishVariables>;
}
export const reserveWishRef: ReserveWishRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reserveWishRef:
```typescript
const name = reserveWishRef.operationName;
console.log(name);
```

### Variables
The `ReserveWish` mutation requires an argument of type `ReserveWishVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ReserveWishVariables {
  wishId: UUIDString;
}
```
### Return Type
Recall that executing the `ReserveWish` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReserveWishData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ReserveWishData {
  reservation_insert: Reservation_Key;
}
```
### Using `ReserveWish`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reserveWish, ReserveWishVariables } from '@dataconnect/generated';

// The `ReserveWish` mutation requires an argument of type `ReserveWishVariables`:
const reserveWishVars: ReserveWishVariables = {
  wishId: ..., 
};

// Call the `reserveWish()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reserveWish(reserveWishVars);
// Variables can be defined inline as well.
const { data } = await reserveWish({ wishId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reserveWish(dataConnect, reserveWishVars);

console.log(data.reservation_insert);

// Or, you can use the `Promise` API.
reserveWish(reserveWishVars).then((response) => {
  const data = response.data;
  console.log(data.reservation_insert);
});
```

### Using `ReserveWish`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reserveWishRef, ReserveWishVariables } from '@dataconnect/generated';

// The `ReserveWish` mutation requires an argument of type `ReserveWishVariables`:
const reserveWishVars: ReserveWishVariables = {
  wishId: ..., 
};

// Call the `reserveWishRef()` function to get a reference to the mutation.
const ref = reserveWishRef(reserveWishVars);
// Variables can be defined inline as well.
const ref = reserveWishRef({ wishId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reserveWishRef(dataConnect, reserveWishVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.reservation_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.reservation_insert);
});
```

## UnreserveWish
You can execute the `UnreserveWish` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
unreserveWish(vars: UnreserveWishVariables): MutationPromise<UnreserveWishData, UnreserveWishVariables>;

interface UnreserveWishRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnreserveWishVariables): MutationRef<UnreserveWishData, UnreserveWishVariables>;
}
export const unreserveWishRef: UnreserveWishRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
unreserveWish(dc: DataConnect, vars: UnreserveWishVariables): MutationPromise<UnreserveWishData, UnreserveWishVariables>;

interface UnreserveWishRef {
  ...
  (dc: DataConnect, vars: UnreserveWishVariables): MutationRef<UnreserveWishData, UnreserveWishVariables>;
}
export const unreserveWishRef: UnreserveWishRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the unreserveWishRef:
```typescript
const name = unreserveWishRef.operationName;
console.log(name);
```

### Variables
The `UnreserveWish` mutation requires an argument of type `UnreserveWishVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UnreserveWishVariables {
  wishId: UUIDString;
}
```
### Return Type
Recall that executing the `UnreserveWish` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UnreserveWishData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UnreserveWishData {
  reservation_deleteMany: number;
}
```
### Using `UnreserveWish`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, unreserveWish, UnreserveWishVariables } from '@dataconnect/generated';

// The `UnreserveWish` mutation requires an argument of type `UnreserveWishVariables`:
const unreserveWishVars: UnreserveWishVariables = {
  wishId: ..., 
};

// Call the `unreserveWish()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await unreserveWish(unreserveWishVars);
// Variables can be defined inline as well.
const { data } = await unreserveWish({ wishId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await unreserveWish(dataConnect, unreserveWishVars);

console.log(data.reservation_deleteMany);

// Or, you can use the `Promise` API.
unreserveWish(unreserveWishVars).then((response) => {
  const data = response.data;
  console.log(data.reservation_deleteMany);
});
```

### Using `UnreserveWish`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, unreserveWishRef, UnreserveWishVariables } from '@dataconnect/generated';

// The `UnreserveWish` mutation requires an argument of type `UnreserveWishVariables`:
const unreserveWishVars: UnreserveWishVariables = {
  wishId: ..., 
};

// Call the `unreserveWishRef()` function to get a reference to the mutation.
const ref = unreserveWishRef(unreserveWishVars);
// Variables can be defined inline as well.
const ref = unreserveWishRef({ wishId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = unreserveWishRef(dataConnect, unreserveWishVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.reservation_deleteMany);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.reservation_deleteMany);
});
```

## JoinWishlist
You can execute the `JoinWishlist` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
joinWishlist(vars: JoinWishlistVariables): MutationPromise<JoinWishlistData, JoinWishlistVariables>;

interface JoinWishlistRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: JoinWishlistVariables): MutationRef<JoinWishlistData, JoinWishlistVariables>;
}
export const joinWishlistRef: JoinWishlistRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
joinWishlist(dc: DataConnect, vars: JoinWishlistVariables): MutationPromise<JoinWishlistData, JoinWishlistVariables>;

interface JoinWishlistRef {
  ...
  (dc: DataConnect, vars: JoinWishlistVariables): MutationRef<JoinWishlistData, JoinWishlistVariables>;
}
export const joinWishlistRef: JoinWishlistRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the joinWishlistRef:
```typescript
const name = joinWishlistRef.operationName;
console.log(name);
```

### Variables
The `JoinWishlist` mutation requires an argument of type `JoinWishlistVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface JoinWishlistVariables {
  ownerUid: string;
}
```
### Return Type
Recall that executing the `JoinWishlist` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `JoinWishlistData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface JoinWishlistData {
  friendship_upsert: Friendship_Key;
}
```
### Using `JoinWishlist`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, joinWishlist, JoinWishlistVariables } from '@dataconnect/generated';

// The `JoinWishlist` mutation requires an argument of type `JoinWishlistVariables`:
const joinWishlistVars: JoinWishlistVariables = {
  ownerUid: ..., 
};

// Call the `joinWishlist()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await joinWishlist(joinWishlistVars);
// Variables can be defined inline as well.
const { data } = await joinWishlist({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await joinWishlist(dataConnect, joinWishlistVars);

console.log(data.friendship_upsert);

// Or, you can use the `Promise` API.
joinWishlist(joinWishlistVars).then((response) => {
  const data = response.data;
  console.log(data.friendship_upsert);
});
```

### Using `JoinWishlist`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, joinWishlistRef, JoinWishlistVariables } from '@dataconnect/generated';

// The `JoinWishlist` mutation requires an argument of type `JoinWishlistVariables`:
const joinWishlistVars: JoinWishlistVariables = {
  ownerUid: ..., 
};

// Call the `joinWishlistRef()` function to get a reference to the mutation.
const ref = joinWishlistRef(joinWishlistVars);
// Variables can be defined inline as well.
const ref = joinWishlistRef({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = joinWishlistRef(dataConnect, joinWishlistVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.friendship_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.friendship_upsert);
});
```

## LeaveWishlist
You can execute the `LeaveWishlist` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
leaveWishlist(vars: LeaveWishlistVariables): MutationPromise<LeaveWishlistData, LeaveWishlistVariables>;

interface LeaveWishlistRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: LeaveWishlistVariables): MutationRef<LeaveWishlistData, LeaveWishlistVariables>;
}
export const leaveWishlistRef: LeaveWishlistRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
leaveWishlist(dc: DataConnect, vars: LeaveWishlistVariables): MutationPromise<LeaveWishlistData, LeaveWishlistVariables>;

interface LeaveWishlistRef {
  ...
  (dc: DataConnect, vars: LeaveWishlistVariables): MutationRef<LeaveWishlistData, LeaveWishlistVariables>;
}
export const leaveWishlistRef: LeaveWishlistRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the leaveWishlistRef:
```typescript
const name = leaveWishlistRef.operationName;
console.log(name);
```

### Variables
The `LeaveWishlist` mutation requires an argument of type `LeaveWishlistVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface LeaveWishlistVariables {
  ownerUid: string;
}
```
### Return Type
Recall that executing the `LeaveWishlist` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `LeaveWishlistData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface LeaveWishlistData {
  friendship_delete?: Friendship_Key | null;
}
```
### Using `LeaveWishlist`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, leaveWishlist, LeaveWishlistVariables } from '@dataconnect/generated';

// The `LeaveWishlist` mutation requires an argument of type `LeaveWishlistVariables`:
const leaveWishlistVars: LeaveWishlistVariables = {
  ownerUid: ..., 
};

// Call the `leaveWishlist()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await leaveWishlist(leaveWishlistVars);
// Variables can be defined inline as well.
const { data } = await leaveWishlist({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await leaveWishlist(dataConnect, leaveWishlistVars);

console.log(data.friendship_delete);

// Or, you can use the `Promise` API.
leaveWishlist(leaveWishlistVars).then((response) => {
  const data = response.data;
  console.log(data.friendship_delete);
});
```

### Using `LeaveWishlist`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, leaveWishlistRef, LeaveWishlistVariables } from '@dataconnect/generated';

// The `LeaveWishlist` mutation requires an argument of type `LeaveWishlistVariables`:
const leaveWishlistVars: LeaveWishlistVariables = {
  ownerUid: ..., 
};

// Call the `leaveWishlistRef()` function to get a reference to the mutation.
const ref = leaveWishlistRef(leaveWishlistVars);
// Variables can be defined inline as well.
const ref = leaveWishlistRef({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = leaveWishlistRef(dataConnect, leaveWishlistVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.friendship_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.friendship_delete);
});
```

## SaveSwipe
You can execute the `SaveSwipe` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
saveSwipe(vars: SaveSwipeVariables): MutationPromise<SaveSwipeData, SaveSwipeVariables>;

interface SaveSwipeRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveSwipeVariables): MutationRef<SaveSwipeData, SaveSwipeVariables>;
}
export const saveSwipeRef: SaveSwipeRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
saveSwipe(dc: DataConnect, vars: SaveSwipeVariables): MutationPromise<SaveSwipeData, SaveSwipeVariables>;

interface SaveSwipeRef {
  ...
  (dc: DataConnect, vars: SaveSwipeVariables): MutationRef<SaveSwipeData, SaveSwipeVariables>;
}
export const saveSwipeRef: SaveSwipeRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the saveSwipeRef:
```typescript
const name = saveSwipeRef.operationName;
console.log(name);
```

### Variables
The `SaveSwipe` mutation requires an argument of type `SaveSwipeVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SaveSwipeVariables {
  ideaId: string;
  liked: boolean;
}
```
### Return Type
Recall that executing the `SaveSwipe` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SaveSwipeData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SaveSwipeData {
  giftSwipe_upsert: GiftSwipe_Key;
}
```
### Using `SaveSwipe`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, saveSwipe, SaveSwipeVariables } from '@dataconnect/generated';

// The `SaveSwipe` mutation requires an argument of type `SaveSwipeVariables`:
const saveSwipeVars: SaveSwipeVariables = {
  ideaId: ..., 
  liked: ..., 
};

// Call the `saveSwipe()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await saveSwipe(saveSwipeVars);
// Variables can be defined inline as well.
const { data } = await saveSwipe({ ideaId: ..., liked: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await saveSwipe(dataConnect, saveSwipeVars);

console.log(data.giftSwipe_upsert);

// Or, you can use the `Promise` API.
saveSwipe(saveSwipeVars).then((response) => {
  const data = response.data;
  console.log(data.giftSwipe_upsert);
});
```

### Using `SaveSwipe`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, saveSwipeRef, SaveSwipeVariables } from '@dataconnect/generated';

// The `SaveSwipe` mutation requires an argument of type `SaveSwipeVariables`:
const saveSwipeVars: SaveSwipeVariables = {
  ideaId: ..., 
  liked: ..., 
};

// Call the `saveSwipeRef()` function to get a reference to the mutation.
const ref = saveSwipeRef(saveSwipeVars);
// Variables can be defined inline as well.
const ref = saveSwipeRef({ ideaId: ..., liked: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = saveSwipeRef(dataConnect, saveSwipeVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.giftSwipe_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.giftSwipe_upsert);
});
```

