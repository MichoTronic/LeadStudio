function getServiceAccountCredentials_() {
  const jsonFile = DriveApp.getFileById(TRACKER_CONFIG.gmail.serviceAccountJsonFileId);
  const jsonContent = jsonFile.getBlob().getDataAsString();
  const jsonKey = JSON.parse(jsonContent);

  return {
    privateKey: jsonKey.private_key,
    clientEmail: jsonKey.client_email,
    clientId: jsonKey.client_id || ''
  };
}

function getServiceAccountInfoForUi() {
  const credentials = getServiceAccountCredentials_();

  return {
    jsonFileId: TRACKER_CONFIG.gmail.serviceAccountJsonFileId,
    clientEmail: credentials.clientEmail || '',
    clientId: credentials.clientId || '',
    delegatedUser: TRACKER_CONFIG.gmail.mailboxUser,
    requiredScopes: [
      'https://www.googleapis.com/auth/gmail.readonly'
    ]
  };
}

function createBaseGmailReadService_() {
  const credentials = getServiceAccountCredentials_();

  return OAuth2.createService('LeadStudio_GmailReadonly_v2')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setPrivateKey(credentials.privateKey)
    .setIssuer(credentials.clientEmail)
    .setScope([
      'https://www.googleapis.com/auth/gmail.readonly'
    ])
    .setPropertyStore(PropertiesService.getScriptProperties());
}

function getDelegatedGmailAccessToken_(userEmail) {
  const baseService = createBaseGmailReadService_();
  const userService = Object.create(baseService);
  userService.setSubject(userEmail);

  if (!userService.hasAccess()) {
    throw new Error('No Gmail API access for ' + userEmail + ': ' + userService.getLastError());
  }

  return userService.getAccessToken();
}
