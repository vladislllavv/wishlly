import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AddMyInterestData {
  interest_upsert: Interest_Key;
  profileInterest_upsert: ProfileInterest_Key;
}

export interface AddMyInterestVariables {
  name: string;
}

export interface AddWishInterestData {
  interest_upsert: Interest_Key;
  wishInterest_upsert: WishInterest_Key;
}

export interface AddWishInterestVariables {
  wishId: UUIDString;
  name: string;
}

export interface CreateGroupData {
  group_insert: Group_Key;
}

export interface CreateGroupVariables {
  name: string;
}

export interface CreateWishData {
  wish_insert: Wish_Key;
}

export interface CreateWishInGroupData {
  wish_insert: Wish_Key;
}

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

export interface CreateWishVariables {
  title: string;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  link?: string | null;
  imageUrl?: string | null;
  note?: string | null;
  shareToIdeas?: boolean;
}

export interface DeleteGroupData {
  wish_updateMany: number;
  group_deleteMany: number;
}

export interface DeleteGroupVariables {
  id: UUIDString;
}

export interface DeleteWishData {
  wish_deleteMany: number;
}

export interface DeleteWishVariables {
  id: UUIDString;
}

export interface Friendship_Key {
  ownerUid: string;
  friendUid: string;
  __typename?: 'Friendship_Key';
}

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

export interface GetProfileVariables {
  uid: string;
}

export interface GiftSwipe_Key {
  userUid: string;
  ideaId: string;
  __typename?: 'GiftSwipe_Key';
}

export interface Group_Key {
  id: UUIDString;
  __typename?: 'Group_Key';
}

export interface GroupsOfOwnerData {
  groups: ({
    id: UUIDString;
    name: string;
    createdAt: TimestampString;
  } & Group_Key)[];
}

export interface GroupsOfOwnerVariables {
  ownerUid: string;
}

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

export interface IdeasByInterestsVariables {
  interests: string[];
  limit?: number | null;
}

export interface Interest_Key {
  name: string;
  __typename?: 'Interest_Key';
}

export interface JoinWishlistData {
  friendship_upsert: Friendship_Key;
}

export interface JoinWishlistVariables {
  ownerUid: string;
}

export interface LeaveWishlistData {
  friendship_delete?: Friendship_Key | null;
}

export interface LeaveWishlistVariables {
  ownerUid: string;
}

export interface ListInterestsData {
  interests: ({
    name: string;
  } & Interest_Key)[];
}

export interface MoveWishToGroupData {
  wish_updateMany: number;
}

export interface MoveWishToGroupVariables {
  id: UUIDString;
  groupId: UUIDString;
}

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

export interface MySwipesData {
  giftSwipes: ({
    ideaId: string;
    liked: boolean;
  })[];
}

export interface NotificationLog_Key {
  key: string;
  __typename?: 'NotificationLog_Key';
}

export interface ProfileInterest_Key {
  profileUid: string;
  interestName: string;
  __typename?: 'ProfileInterest_Key';
}

export interface Profile_Key {
  uid: string;
  __typename?: 'Profile_Key';
}

export interface RemoveMyInterestData {
  profileInterest_delete?: ProfileInterest_Key | null;
}

export interface RemoveMyInterestVariables {
  name: string;
}

export interface RemoveWishInterestData {
  wishInterest_deleteMany: number;
}

export interface RemoveWishInterestVariables {
  wishId: UUIDString;
  name: string;
}

export interface RenameGroupData {
  group_updateMany: number;
}

export interface RenameGroupVariables {
  id: UUIDString;
  name: string;
}

export interface Reservation_Key {
  wishId: UUIDString;
  __typename?: 'Reservation_Key';
}

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

export interface ReservationsOfOwnerVariables {
  ownerUid: string;
}

export interface ReserveWishData {
  reservation_insert: Reservation_Key;
}

export interface ReserveWishVariables {
  wishId: UUIDString;
}

export interface SaveSwipeData {
  giftSwipe_upsert: GiftSwipe_Key;
}

export interface SaveSwipeVariables {
  ideaId: string;
  liked: boolean;
}

export interface UngroupWishData {
  wish_updateMany: number;
}

export interface UngroupWishVariables {
  id: UUIDString;
}

export interface UnreserveWishData {
  reservation_deleteMany: number;
}

export interface UnreserveWishVariables {
  wishId: UUIDString;
}

export interface UpdateWishData {
  wish_updateMany: number;
}

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

export interface UpsertMyProfileData {
  profile_upsert: Profile_Key;
}

export interface UpsertMyProfileVariables {
  firstName?: string | null;
  birthdate?: DateString | null;
  gender?: string | null;
  onboardingCompleted?: boolean;
}

export interface WishInterest_Key {
  wishId: UUIDString;
  interestName: string;
  __typename?: 'WishInterest_Key';
}

export interface Wish_Key {
  id: UUIDString;
  __typename?: 'Wish_Key';
}

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

export interface WishesOfOwnerVariables {
  ownerUid: string;
}

interface UpsertMyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
  operationName: string;
}
export const upsertMyProfileRef: UpsertMyProfileRef;

export function upsertMyProfile(vars?: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;
export function upsertMyProfile(dc: DataConnect, vars?: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;

interface AddMyInterestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddMyInterestVariables): MutationRef<AddMyInterestData, AddMyInterestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddMyInterestVariables): MutationRef<AddMyInterestData, AddMyInterestVariables>;
  operationName: string;
}
export const addMyInterestRef: AddMyInterestRef;

export function addMyInterest(vars: AddMyInterestVariables): MutationPromise<AddMyInterestData, AddMyInterestVariables>;
export function addMyInterest(dc: DataConnect, vars: AddMyInterestVariables): MutationPromise<AddMyInterestData, AddMyInterestVariables>;

interface RemoveMyInterestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveMyInterestVariables): MutationRef<RemoveMyInterestData, RemoveMyInterestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveMyInterestVariables): MutationRef<RemoveMyInterestData, RemoveMyInterestVariables>;
  operationName: string;
}
export const removeMyInterestRef: RemoveMyInterestRef;

export function removeMyInterest(vars: RemoveMyInterestVariables): MutationPromise<RemoveMyInterestData, RemoveMyInterestVariables>;
export function removeMyInterest(dc: DataConnect, vars: RemoveMyInterestVariables): MutationPromise<RemoveMyInterestData, RemoveMyInterestVariables>;

interface CreateGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGroupVariables): MutationRef<CreateGroupData, CreateGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateGroupVariables): MutationRef<CreateGroupData, CreateGroupVariables>;
  operationName: string;
}
export const createGroupRef: CreateGroupRef;

export function createGroup(vars: CreateGroupVariables): MutationPromise<CreateGroupData, CreateGroupVariables>;
export function createGroup(dc: DataConnect, vars: CreateGroupVariables): MutationPromise<CreateGroupData, CreateGroupVariables>;

interface RenameGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RenameGroupVariables): MutationRef<RenameGroupData, RenameGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RenameGroupVariables): MutationRef<RenameGroupData, RenameGroupVariables>;
  operationName: string;
}
export const renameGroupRef: RenameGroupRef;

export function renameGroup(vars: RenameGroupVariables): MutationPromise<RenameGroupData, RenameGroupVariables>;
export function renameGroup(dc: DataConnect, vars: RenameGroupVariables): MutationPromise<RenameGroupData, RenameGroupVariables>;

interface DeleteGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGroupVariables): MutationRef<DeleteGroupData, DeleteGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteGroupVariables): MutationRef<DeleteGroupData, DeleteGroupVariables>;
  operationName: string;
}
export const deleteGroupRef: DeleteGroupRef;

export function deleteGroup(vars: DeleteGroupVariables): MutationPromise<DeleteGroupData, DeleteGroupVariables>;
export function deleteGroup(dc: DataConnect, vars: DeleteGroupVariables): MutationPromise<DeleteGroupData, DeleteGroupVariables>;

interface CreateWishRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWishVariables): MutationRef<CreateWishData, CreateWishVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateWishVariables): MutationRef<CreateWishData, CreateWishVariables>;
  operationName: string;
}
export const createWishRef: CreateWishRef;

export function createWish(vars: CreateWishVariables): MutationPromise<CreateWishData, CreateWishVariables>;
export function createWish(dc: DataConnect, vars: CreateWishVariables): MutationPromise<CreateWishData, CreateWishVariables>;

interface CreateWishInGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWishInGroupVariables): MutationRef<CreateWishInGroupData, CreateWishInGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateWishInGroupVariables): MutationRef<CreateWishInGroupData, CreateWishInGroupVariables>;
  operationName: string;
}
export const createWishInGroupRef: CreateWishInGroupRef;

export function createWishInGroup(vars: CreateWishInGroupVariables): MutationPromise<CreateWishInGroupData, CreateWishInGroupVariables>;
export function createWishInGroup(dc: DataConnect, vars: CreateWishInGroupVariables): MutationPromise<CreateWishInGroupData, CreateWishInGroupVariables>;

interface UpdateWishRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateWishVariables): MutationRef<UpdateWishData, UpdateWishVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateWishVariables): MutationRef<UpdateWishData, UpdateWishVariables>;
  operationName: string;
}
export const updateWishRef: UpdateWishRef;

export function updateWish(vars: UpdateWishVariables): MutationPromise<UpdateWishData, UpdateWishVariables>;
export function updateWish(dc: DataConnect, vars: UpdateWishVariables): MutationPromise<UpdateWishData, UpdateWishVariables>;

interface MoveWishToGroupRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MoveWishToGroupVariables): MutationRef<MoveWishToGroupData, MoveWishToGroupVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MoveWishToGroupVariables): MutationRef<MoveWishToGroupData, MoveWishToGroupVariables>;
  operationName: string;
}
export const moveWishToGroupRef: MoveWishToGroupRef;

export function moveWishToGroup(vars: MoveWishToGroupVariables): MutationPromise<MoveWishToGroupData, MoveWishToGroupVariables>;
export function moveWishToGroup(dc: DataConnect, vars: MoveWishToGroupVariables): MutationPromise<MoveWishToGroupData, MoveWishToGroupVariables>;

interface UngroupWishRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UngroupWishVariables): MutationRef<UngroupWishData, UngroupWishVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UngroupWishVariables): MutationRef<UngroupWishData, UngroupWishVariables>;
  operationName: string;
}
export const ungroupWishRef: UngroupWishRef;

export function ungroupWish(vars: UngroupWishVariables): MutationPromise<UngroupWishData, UngroupWishVariables>;
export function ungroupWish(dc: DataConnect, vars: UngroupWishVariables): MutationPromise<UngroupWishData, UngroupWishVariables>;

interface DeleteWishRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteWishVariables): MutationRef<DeleteWishData, DeleteWishVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteWishVariables): MutationRef<DeleteWishData, DeleteWishVariables>;
  operationName: string;
}
export const deleteWishRef: DeleteWishRef;

export function deleteWish(vars: DeleteWishVariables): MutationPromise<DeleteWishData, DeleteWishVariables>;
export function deleteWish(dc: DataConnect, vars: DeleteWishVariables): MutationPromise<DeleteWishData, DeleteWishVariables>;

interface AddWishInterestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddWishInterestVariables): MutationRef<AddWishInterestData, AddWishInterestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddWishInterestVariables): MutationRef<AddWishInterestData, AddWishInterestVariables>;
  operationName: string;
}
export const addWishInterestRef: AddWishInterestRef;

export function addWishInterest(vars: AddWishInterestVariables): MutationPromise<AddWishInterestData, AddWishInterestVariables>;
export function addWishInterest(dc: DataConnect, vars: AddWishInterestVariables): MutationPromise<AddWishInterestData, AddWishInterestVariables>;

interface RemoveWishInterestRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveWishInterestVariables): MutationRef<RemoveWishInterestData, RemoveWishInterestVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveWishInterestVariables): MutationRef<RemoveWishInterestData, RemoveWishInterestVariables>;
  operationName: string;
}
export const removeWishInterestRef: RemoveWishInterestRef;

export function removeWishInterest(vars: RemoveWishInterestVariables): MutationPromise<RemoveWishInterestData, RemoveWishInterestVariables>;
export function removeWishInterest(dc: DataConnect, vars: RemoveWishInterestVariables): MutationPromise<RemoveWishInterestData, RemoveWishInterestVariables>;

interface ReserveWishRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReserveWishVariables): MutationRef<ReserveWishData, ReserveWishVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReserveWishVariables): MutationRef<ReserveWishData, ReserveWishVariables>;
  operationName: string;
}
export const reserveWishRef: ReserveWishRef;

export function reserveWish(vars: ReserveWishVariables): MutationPromise<ReserveWishData, ReserveWishVariables>;
export function reserveWish(dc: DataConnect, vars: ReserveWishVariables): MutationPromise<ReserveWishData, ReserveWishVariables>;

interface UnreserveWishRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UnreserveWishVariables): MutationRef<UnreserveWishData, UnreserveWishVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UnreserveWishVariables): MutationRef<UnreserveWishData, UnreserveWishVariables>;
  operationName: string;
}
export const unreserveWishRef: UnreserveWishRef;

export function unreserveWish(vars: UnreserveWishVariables): MutationPromise<UnreserveWishData, UnreserveWishVariables>;
export function unreserveWish(dc: DataConnect, vars: UnreserveWishVariables): MutationPromise<UnreserveWishData, UnreserveWishVariables>;

interface JoinWishlistRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: JoinWishlistVariables): MutationRef<JoinWishlistData, JoinWishlistVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: JoinWishlistVariables): MutationRef<JoinWishlistData, JoinWishlistVariables>;
  operationName: string;
}
export const joinWishlistRef: JoinWishlistRef;

export function joinWishlist(vars: JoinWishlistVariables): MutationPromise<JoinWishlistData, JoinWishlistVariables>;
export function joinWishlist(dc: DataConnect, vars: JoinWishlistVariables): MutationPromise<JoinWishlistData, JoinWishlistVariables>;

interface LeaveWishlistRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: LeaveWishlistVariables): MutationRef<LeaveWishlistData, LeaveWishlistVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: LeaveWishlistVariables): MutationRef<LeaveWishlistData, LeaveWishlistVariables>;
  operationName: string;
}
export const leaveWishlistRef: LeaveWishlistRef;

export function leaveWishlist(vars: LeaveWishlistVariables): MutationPromise<LeaveWishlistData, LeaveWishlistVariables>;
export function leaveWishlist(dc: DataConnect, vars: LeaveWishlistVariables): MutationPromise<LeaveWishlistData, LeaveWishlistVariables>;

interface SaveSwipeRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SaveSwipeVariables): MutationRef<SaveSwipeData, SaveSwipeVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SaveSwipeVariables): MutationRef<SaveSwipeData, SaveSwipeVariables>;
  operationName: string;
}
export const saveSwipeRef: SaveSwipeRef;

export function saveSwipe(vars: SaveSwipeVariables): MutationPromise<SaveSwipeData, SaveSwipeVariables>;
export function saveSwipe(dc: DataConnect, vars: SaveSwipeVariables): MutationPromise<SaveSwipeData, SaveSwipeVariables>;

interface MyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyProfileData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MyProfileData, undefined>;
  operationName: string;
}
export const myProfileRef: MyProfileRef;

export function myProfile(options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;
export function myProfile(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyProfileData, undefined>;

interface GetProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProfileVariables): QueryRef<GetProfileData, GetProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetProfileVariables): QueryRef<GetProfileData, GetProfileVariables>;
  operationName: string;
}
export const getProfileRef: GetProfileRef;

export function getProfile(vars: GetProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetProfileData, GetProfileVariables>;
export function getProfile(dc: DataConnect, vars: GetProfileVariables, options?: ExecuteQueryOptions): QueryPromise<GetProfileData, GetProfileVariables>;

interface ListInterestsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListInterestsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListInterestsData, undefined>;
  operationName: string;
}
export const listInterestsRef: ListInterestsRef;

export function listInterests(options?: ExecuteQueryOptions): QueryPromise<ListInterestsData, undefined>;
export function listInterests(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListInterestsData, undefined>;

interface WishesOfOwnerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: WishesOfOwnerVariables): QueryRef<WishesOfOwnerData, WishesOfOwnerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: WishesOfOwnerVariables): QueryRef<WishesOfOwnerData, WishesOfOwnerVariables>;
  operationName: string;
}
export const wishesOfOwnerRef: WishesOfOwnerRef;

export function wishesOfOwner(vars: WishesOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<WishesOfOwnerData, WishesOfOwnerVariables>;
export function wishesOfOwner(dc: DataConnect, vars: WishesOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<WishesOfOwnerData, WishesOfOwnerVariables>;

interface GroupsOfOwnerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GroupsOfOwnerVariables): QueryRef<GroupsOfOwnerData, GroupsOfOwnerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GroupsOfOwnerVariables): QueryRef<GroupsOfOwnerData, GroupsOfOwnerVariables>;
  operationName: string;
}
export const groupsOfOwnerRef: GroupsOfOwnerRef;

export function groupsOfOwner(vars: GroupsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<GroupsOfOwnerData, GroupsOfOwnerVariables>;
export function groupsOfOwner(dc: DataConnect, vars: GroupsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<GroupsOfOwnerData, GroupsOfOwnerVariables>;

interface ReservationsOfOwnerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReservationsOfOwnerVariables): QueryRef<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReservationsOfOwnerVariables): QueryRef<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;
  operationName: string;
}
export const reservationsOfOwnerRef: ReservationsOfOwnerRef;

export function reservationsOfOwner(vars: ReservationsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;
export function reservationsOfOwner(dc: DataConnect, vars: ReservationsOfOwnerVariables, options?: ExecuteQueryOptions): QueryPromise<ReservationsOfOwnerData, ReservationsOfOwnerVariables>;

interface MyReservedWishesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyReservedWishesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MyReservedWishesData, undefined>;
  operationName: string;
}
export const myReservedWishesRef: MyReservedWishesRef;

export function myReservedWishes(options?: ExecuteQueryOptions): QueryPromise<MyReservedWishesData, undefined>;
export function myReservedWishes(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyReservedWishesData, undefined>;

interface MyFriendshipsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MyFriendshipsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MyFriendshipsData, undefined>;
  operationName: string;
}
export const myFriendshipsRef: MyFriendshipsRef;

export function myFriendships(options?: ExecuteQueryOptions): QueryPromise<MyFriendshipsData, undefined>;
export function myFriendships(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MyFriendshipsData, undefined>;

interface MySwipesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<MySwipesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<MySwipesData, undefined>;
  operationName: string;
}
export const mySwipesRef: MySwipesRef;

export function mySwipes(options?: ExecuteQueryOptions): QueryPromise<MySwipesData, undefined>;
export function mySwipes(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<MySwipesData, undefined>;

interface IdeasByInterestsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: IdeasByInterestsVariables): QueryRef<IdeasByInterestsData, IdeasByInterestsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: IdeasByInterestsVariables): QueryRef<IdeasByInterestsData, IdeasByInterestsVariables>;
  operationName: string;
}
export const ideasByInterestsRef: IdeasByInterestsRef;

export function ideasByInterests(vars: IdeasByInterestsVariables, options?: ExecuteQueryOptions): QueryPromise<IdeasByInterestsData, IdeasByInterestsVariables>;
export function ideasByInterests(dc: DataConnect, vars: IdeasByInterestsVariables, options?: ExecuteQueryOptions): QueryPromise<IdeasByInterestsData, IdeasByInterestsVariables>;

