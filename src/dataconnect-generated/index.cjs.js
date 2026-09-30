const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'wishlly',
  service: 'wishlly-932c0-service',
  location: 'europe-north1'
};
exports.connectorConfig = connectorConfig;

const upsertMyProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertMyProfile', inputVars);
}
upsertMyProfileRef.operationName = 'UpsertMyProfile';
exports.upsertMyProfileRef = upsertMyProfileRef;

exports.upsertMyProfile = function upsertMyProfile(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars);
  return executeMutation(upsertMyProfileRef(dcInstance, inputVars));
}
;

const addMyInterestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddMyInterest', inputVars);
}
addMyInterestRef.operationName = 'AddMyInterest';
exports.addMyInterestRef = addMyInterestRef;

exports.addMyInterest = function addMyInterest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addMyInterestRef(dcInstance, inputVars));
}
;

const removeMyInterestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveMyInterest', inputVars);
}
removeMyInterestRef.operationName = 'RemoveMyInterest';
exports.removeMyInterestRef = removeMyInterestRef;

exports.removeMyInterest = function removeMyInterest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeMyInterestRef(dcInstance, inputVars));
}
;

const createGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGroup', inputVars);
}
createGroupRef.operationName = 'CreateGroup';
exports.createGroupRef = createGroupRef;

exports.createGroup = function createGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGroupRef(dcInstance, inputVars));
}
;

const renameGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RenameGroup', inputVars);
}
renameGroupRef.operationName = 'RenameGroup';
exports.renameGroupRef = renameGroupRef;

exports.renameGroup = function renameGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(renameGroupRef(dcInstance, inputVars));
}
;

const deleteGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteGroup', inputVars);
}
deleteGroupRef.operationName = 'DeleteGroup';
exports.deleteGroupRef = deleteGroupRef;

exports.deleteGroup = function deleteGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteGroupRef(dcInstance, inputVars));
}
;

const createWishRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateWish', inputVars);
}
createWishRef.operationName = 'CreateWish';
exports.createWishRef = createWishRef;

exports.createWish = function createWish(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createWishRef(dcInstance, inputVars));
}
;

const createWishInGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateWishInGroup', inputVars);
}
createWishInGroupRef.operationName = 'CreateWishInGroup';
exports.createWishInGroupRef = createWishInGroupRef;

exports.createWishInGroup = function createWishInGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createWishInGroupRef(dcInstance, inputVars));
}
;

const updateWishRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateWish', inputVars);
}
updateWishRef.operationName = 'UpdateWish';
exports.updateWishRef = updateWishRef;

exports.updateWish = function updateWish(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateWishRef(dcInstance, inputVars));
}
;

const moveWishToGroupRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MoveWishToGroup', inputVars);
}
moveWishToGroupRef.operationName = 'MoveWishToGroup';
exports.moveWishToGroupRef = moveWishToGroupRef;

exports.moveWishToGroup = function moveWishToGroup(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(moveWishToGroupRef(dcInstance, inputVars));
}
;

const ungroupWishRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UngroupWish', inputVars);
}
ungroupWishRef.operationName = 'UngroupWish';
exports.ungroupWishRef = ungroupWishRef;

exports.ungroupWish = function ungroupWish(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(ungroupWishRef(dcInstance, inputVars));
}
;

const deleteWishRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteWish', inputVars);
}
deleteWishRef.operationName = 'DeleteWish';
exports.deleteWishRef = deleteWishRef;

exports.deleteWish = function deleteWish(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteWishRef(dcInstance, inputVars));
}
;

const addWishInterestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddWishInterest', inputVars);
}
addWishInterestRef.operationName = 'AddWishInterest';
exports.addWishInterestRef = addWishInterestRef;

exports.addWishInterest = function addWishInterest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addWishInterestRef(dcInstance, inputVars));
}
;

const removeWishInterestRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveWishInterest', inputVars);
}
removeWishInterestRef.operationName = 'RemoveWishInterest';
exports.removeWishInterestRef = removeWishInterestRef;

exports.removeWishInterest = function removeWishInterest(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeWishInterestRef(dcInstance, inputVars));
}
;

const reserveWishRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReserveWish', inputVars);
}
reserveWishRef.operationName = 'ReserveWish';
exports.reserveWishRef = reserveWishRef;

exports.reserveWish = function reserveWish(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reserveWishRef(dcInstance, inputVars));
}
;

const unreserveWishRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UnreserveWish', inputVars);
}
unreserveWishRef.operationName = 'UnreserveWish';
exports.unreserveWishRef = unreserveWishRef;

exports.unreserveWish = function unreserveWish(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(unreserveWishRef(dcInstance, inputVars));
}
;

const joinWishlistRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'JoinWishlist', inputVars);
}
joinWishlistRef.operationName = 'JoinWishlist';
exports.joinWishlistRef = joinWishlistRef;

exports.joinWishlist = function joinWishlist(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(joinWishlistRef(dcInstance, inputVars));
}
;

const leaveWishlistRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'LeaveWishlist', inputVars);
}
leaveWishlistRef.operationName = 'LeaveWishlist';
exports.leaveWishlistRef = leaveWishlistRef;

exports.leaveWishlist = function leaveWishlist(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(leaveWishlistRef(dcInstance, inputVars));
}
;

const saveSwipeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SaveSwipe', inputVars);
}
saveSwipeRef.operationName = 'SaveSwipe';
exports.saveSwipeRef = saveSwipeRef;

exports.saveSwipe = function saveSwipe(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(saveSwipeRef(dcInstance, inputVars));
}
;

const myProfileRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MyProfile');
}
myProfileRef.operationName = 'MyProfile';
exports.myProfileRef = myProfileRef;

exports.myProfile = function myProfile(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(myProfileRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetProfile', inputVars);
}
getProfileRef.operationName = 'GetProfile';
exports.getProfileRef = getProfileRef;

exports.getProfile = function getProfile(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getProfileRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listInterestsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListInterests');
}
listInterestsRef.operationName = 'ListInterests';
exports.listInterestsRef = listInterestsRef;

exports.listInterests = function listInterests(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listInterestsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const wishesOfOwnerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'WishesOfOwner', inputVars);
}
wishesOfOwnerRef.operationName = 'WishesOfOwner';
exports.wishesOfOwnerRef = wishesOfOwnerRef;

exports.wishesOfOwner = function wishesOfOwner(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(wishesOfOwnerRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const groupsOfOwnerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GroupsOfOwner', inputVars);
}
groupsOfOwnerRef.operationName = 'GroupsOfOwner';
exports.groupsOfOwnerRef = groupsOfOwnerRef;

exports.groupsOfOwner = function groupsOfOwner(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(groupsOfOwnerRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const reservationsOfOwnerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ReservationsOfOwner', inputVars);
}
reservationsOfOwnerRef.operationName = 'ReservationsOfOwner';
exports.reservationsOfOwnerRef = reservationsOfOwnerRef;

exports.reservationsOfOwner = function reservationsOfOwner(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(reservationsOfOwnerRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const myReservedWishesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MyReservedWishes');
}
myReservedWishesRef.operationName = 'MyReservedWishes';
exports.myReservedWishesRef = myReservedWishesRef;

exports.myReservedWishes = function myReservedWishes(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(myReservedWishesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const myFriendshipsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MyFriendships');
}
myFriendshipsRef.operationName = 'MyFriendships';
exports.myFriendshipsRef = myFriendshipsRef;

exports.myFriendships = function myFriendships(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(myFriendshipsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const mySwipesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'MySwipes');
}
mySwipesRef.operationName = 'MySwipes';
exports.mySwipesRef = mySwipesRef;

exports.mySwipes = function mySwipes(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(mySwipesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const ideasByInterestsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'IdeasByInterests', inputVars);
}
ideasByInterestsRef.operationName = 'IdeasByInterests';
exports.ideasByInterestsRef = ideasByInterestsRef;

exports.ideasByInterests = function ideasByInterests(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(ideasByInterestsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
