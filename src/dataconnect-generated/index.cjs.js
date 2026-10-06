const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'ideas',
  service: 'wishlly-932c0-service',
  location: 'europe-north1'
};
exports.connectorConfig = connectorConfig;

const addIdeaRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddIdea', inputVars);
}
addIdeaRef.operationName = 'AddIdea';
exports.addIdeaRef = addIdeaRef;

exports.addIdea = function addIdea(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addIdeaRef(dcInstance, inputVars));
}
;

const removeIdeaRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveIdea', inputVars);
}
removeIdeaRef.operationName = 'RemoveIdea';
exports.removeIdeaRef = removeIdeaRef;

exports.removeIdea = function removeIdea(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeIdeaRef(dcInstance, inputVars));
}
;

const reportIdeaRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReportIdea', inputVars);
}
reportIdeaRef.operationName = 'ReportIdea';
exports.reportIdeaRef = reportIdeaRef;

exports.reportIdea = function reportIdea(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reportIdeaRef(dcInstance, inputVars));
}
;

const listApprovedIdeasRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListApprovedIdeas', inputVars);
}
listApprovedIdeasRef.operationName = 'ListApprovedIdeas';
exports.listApprovedIdeasRef = listApprovedIdeasRef;

exports.listApprovedIdeas = function listApprovedIdeas(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listApprovedIdeasRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
