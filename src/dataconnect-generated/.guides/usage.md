# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { upsertMyProfile, addMyInterest, removeMyInterest, createGroup, renameGroup, deleteGroup, createWish, createWishInGroup, updateWish, moveWishToGroup } from '@dataconnect/generated';


// Operation UpsertMyProfile:  For variables, look at type UpsertMyProfileVars in ../index.d.ts
const { data } = await UpsertMyProfile(dataConnect, upsertMyProfileVars);

// Operation AddMyInterest:  For variables, look at type AddMyInterestVars in ../index.d.ts
const { data } = await AddMyInterest(dataConnect, addMyInterestVars);

// Operation RemoveMyInterest:  For variables, look at type RemoveMyInterestVars in ../index.d.ts
const { data } = await RemoveMyInterest(dataConnect, removeMyInterestVars);

// Operation CreateGroup:  For variables, look at type CreateGroupVars in ../index.d.ts
const { data } = await CreateGroup(dataConnect, createGroupVars);

// Operation RenameGroup:  For variables, look at type RenameGroupVars in ../index.d.ts
const { data } = await RenameGroup(dataConnect, renameGroupVars);

// Operation DeleteGroup:  For variables, look at type DeleteGroupVars in ../index.d.ts
const { data } = await DeleteGroup(dataConnect, deleteGroupVars);

// Operation CreateWish:  For variables, look at type CreateWishVars in ../index.d.ts
const { data } = await CreateWish(dataConnect, createWishVars);

// Operation CreateWishInGroup:  For variables, look at type CreateWishInGroupVars in ../index.d.ts
const { data } = await CreateWishInGroup(dataConnect, createWishInGroupVars);

// Operation UpdateWish:  For variables, look at type UpdateWishVars in ../index.d.ts
const { data } = await UpdateWish(dataConnect, updateWishVars);

// Operation MoveWishToGroup:  For variables, look at type MoveWishToGroupVars in ../index.d.ts
const { data } = await MoveWishToGroup(dataConnect, moveWishToGroupVars);


```