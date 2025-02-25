const getAllEventData = require('getAllEventData');
const JSON = require('JSON');
const sendHttpRequest = require('sendHttpRequest');
const getTimestampMillis = require('getTimestampMillis');
const setCookie = require('setCookie');
const getCookieValues = require('getCookieValues');
const getContainerVersion = require('getContainerVersion');
const logToConsole = require('logToConsole');
const sha256Sync = require('sha256Sync');
const makeString = require('makeString');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const Math = require('Math');
const generateRandom = require('generateRandom');
const parseUrl = require('parseUrl');
const makeNumber = require('makeNumber');
const encodeUriComponent = require('encodeUriComponent');

const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');

const eventData = getAllEventData();
const url = eventData.page_location || getRequestHeader('referer');

if (!isConsentGivenOrNotRequired()) {
  return data.gtmOnSuccess();
}

if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

const pixelOrAppId = data.eventConversionType === 'MOBILE_APP' ? data.snapAppId : data.pixelId;
if (!pixelOrAppId || !data.accessToken) {
  return data.gtmOnFailure();
}

const commonCookie = eventData.common_cookie || {};

sendTrackRequest(mapEvent(eventData, data));

function sendTrackRequest(mappedEvent) {
  const postBody = {
    data: [mappedEvent]
  };
  const postUrl = getPostUrl();

  if (isLoggingEnabled) {
    logToConsole(
      JSON.stringify({
        Name: 'Snapchat',
        Type: 'Request',
        TraceId: traceId,
        EventName: mappedEvent.event_name,
        RequestMethod: 'POST',
        RequestUrl: postUrl,
        RequestBody: postBody
      })
    );
  }

  const cookieOptions = {
    domain: 'auto',
    path: '/',
    samesite: 'Lax',
    secure: true,
    'max-age': 31536000, // 1 year
    httpOnly: !!data.useHttpOnlyCookie
  };

  if (mappedEvent.user_data.sc_click_id && !data.notSetClickIdCookie) {
    setCookie('_scclid', mappedEvent.user_data.sc_click_id, cookieOptions);
  }

  if (mappedEvent.user_data.sc_cookie1 && !data.notSetBrowserIdCookie) {
    setCookie('_scid', mappedEvent.user_data.sc_cookie1, cookieOptions);
  }

  sendHttpRequest(
    postUrl,
    (statusCode, headers, body) => {
      if (isLoggingEnabled) {
        logToConsole(
          JSON.stringify({
            Name: 'Snapchat',
            Type: 'Response',
            TraceId: traceId,
            EventName: mappedEvent.event_name,
            ResponseStatusCode: statusCode,
            ResponseHeaders: headers,
            ResponseBody: body
          })
        );
      }
      if (!data.useOptimisticScenario) {
        if (statusCode >= 200 && statusCode < 400) {
          data.gtmOnSuccess();
        } else {
          data.gtmOnFailure();
        }
      }
    },
    {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    },
    JSON.stringify(postBody)
  );
}

if (data.useOptimisticScenario) {
  data.gtmOnSuccess();
}

function getPostUrl() {
  let postUrl = 'https://tr.snapchat.com/v3/' + encodeUriComponent(pixelOrAppId) + '/events';
  if (data.validate) {
    postUrl = postUrl + '/validate';
  }
  postUrl = postUrl + '?access_token=' + data.accessToken;
  return postUrl;
}

function getEventName(eventData, data) {
  if (data.eventType === 'inherit') {
    let eventName = eventData.event_name;

    let gaToEventName = {
      page_view: 'PAGE_VIEW',
      'gtm.dom': 'PAGE_VIEW',
      add_to_cart: 'ADD_CART',
      sign_up: 'SIGN_UP',
      purchase: 'PURCHASE',
      view_item: 'VIEW_CONTENT',
      add_to_wishlist: 'ADD_TO_WISHLIST',
      begin_checkout: 'START_CHECKOUT',
      add_payment_info: 'ADD_BILLING',
      view_item_list: 'LIST_VIEW',
      tutorial_complete: 'COMPLETE_TUTORIAL',
      search: 'SEARCH',
      generate_lead: 'SIGN_UP',

      contact: 'CUSTOM_EVENT_2',
      customize_product: 'CUSTOM_EVENT_3',
      donate: 'SPENT_CREDITS',
      find_location: 'SEARCH',
      schedule: 'CUSTOM_EVENT_4',
      start_trial: 'START_TRIAL',
      submit_application: 'SUBSCRIBE',
      subscribe: 'SUBSCRIBE',

      'gtm4wp.addProductToCartEEC': 'ADD_CART',
      'gtm4wp.productClickEEC': 'VIEW_CONTENT',
      'gtm4wp.checkoutOptionEEC': 'START_CHECKOUT',
      'gtm4wp.checkoutStepEEC': 'ADD_BILLING',
      'gtm4wp.orderCompletedEEC': 'PURCHASE'
    };

    if (!gaToEventName[eventName]) {
      return eventName;
    }

    return gaToEventName[eventName];
  }

  return data.eventType === 'standard' ? data.eventNameStandard : data.eventNameCustom;
}

function mapEvent(eventData, data) {
  let mappedData = {
    version: '3.0',
    user_data: {},
    custom_data: {}
  };

  mappedData = addServerData(eventData, mappedData);
  mappedData = addUserData(eventData, mappedData);
  mappedData = addCustomData(eventData, mappedData);
  mappedData = addAppData(eventData, mappedData);
  mappedData = hashDataIfNeeded(mappedData);

  return mappedData;
}

function addCustomData(eventData, mappedData) {
  let currencyFromItems = '';
  let valueFromItems = 0;

  if (eventData.items && eventData.items[0]) {
    mappedData.custom_data.contents = [];
    mappedData.custom_data.content_type = 'product';
    currencyFromItems = eventData.items[0].currency;
    mappedData.custom_data.num_items = eventData.items.length;

    if (!eventData.items[1]) {
      if (eventData.items[0].item_name) mappedData.custom_data.content_name = eventData.items[0].item_name;
      if (eventData.items[0].item_category) mappedData.custom_data.content_category = eventData.items[0].item_category;
      if (eventData.items[0].item_id) mappedData.custom_data.content_ids = eventData.items[0].item_id;

      if (eventData.items[0].price) {
        mappedData.custom_data.value = eventData.items[0].quantity
          ? eventData.items[0].quantity * eventData.items[0].price
          : eventData.items[0].price;
      }
    }

    const itemIdKey = data.itemIdKey ? data.itemIdKey : 'item_id';
    eventData.items.forEach((d, i) => {
      let content = {};
      if (d[itemIdKey]) content.id = d[itemIdKey];
      if (d.quantity) content.quantity = d.quantity;
      if (d.delivery_category) content.delivery_category = d.delivery_category;

      if (d.price) {
        content.item_price = makeNumber(d.price);
        valueFromItems += d.quantity ? d.quantity * content.item_price : content.item_price;
      }

      mappedData.custom_data.contents.push(content);
    });
  }

  if (eventData['x-ga-mp1-ev']) mappedData.custom_data.value = eventData['x-ga-mp1-ev'];
  else if (eventData['x-ga-mp1-tr']) mappedData.custom_data.value = eventData['x-ga-mp1-tr'];
  else if (eventData.value) mappedData.custom_data.value = eventData.value;

  if (eventData.currency) mappedData.custom_data.currency = eventData.currency;
  else if (currencyFromItems) mappedData.custom_data.currency = currencyFromItems;

  if (eventData.search_term) mappedData.custom_data.search_string = eventData.search_term;

  if (eventData.transaction_id) mappedData.custom_data.order_id = eventData.transaction_id;

  if (mappedData.event_name === 'Purchase') {
    if (!mappedData.custom_data.currency) mappedData.custom_data.currency = 'USD';
    if (!mappedData.custom_data.value) mappedData.custom_data.value = valueFromItems ? valueFromItems : 0;
  }
  if (eventData.predicted_ltv) mappedData.custom_data.predicted_ltv = eventData.predicted_ltv;
  if (eventData.sign_up_method) mappedData.custom_data.sign_up_method = eventData.sign_up_method;
  if (eventData.brands) mappedData.custom_data.brands = eventData.brands;

  if (data.customDataList) {
    data.customDataList.forEach((d) => {
      if (isValidValue(d.value)) {
        mappedData.custom_data[d.name] = d.value;
      }
    });
  }

  return mappedData;
}

function addAppData(eventData, mappedData) {
  if (data.eventConversionType !== 'MOBILE_APP') return mappedData;
  const appData = eventData.app_data || {};
  mappedData.app_data = {};

  const appId = data.appId || appData.app_id;
  if (appId) mappedData.app_data.app_id = appId;

  const extinfo = data.extinfo || appData.extinfo;
  if (extinfo) mappedData.app_data.extinfo = extinfo;

  const advertiser_tracking_enabled = data.advertiserTrackingEnabled || appData.advertiser_tracking_enabled;
  if (advertiser_tracking_enabled) mappedData.app_data.advertiser_tracking_enabled = advertiser_tracking_enabled;

  if (data.appDataList) {
    data.appDataList.forEach((d) => {
      if (isValidValue(d.value)) {
        mappedData.app_data[d.name] = d.value;
      }
    });
  }

  return mappedData;
}

function addServerData(eventData, mappedData) {
  mappedData.event_name = getEventName(eventData, data);
  mappedData.event_time = Math.round(getTimestampMillis() / 1000);
  mappedData.action_source = data.eventConversionType;
  mappedData.test_event_code = data.testEventCode;
  mappedData.integration = 'stape';

  if (data.eventConversionType === 'WEB') {
    mappedData.event_source_url = eventData.page_location || getRequestHeader('referer');
  }

  const eventId = eventData.event_id || eventData.transaction_id;
  if (eventId) mappedData.event_id = eventId;
  if (eventData.test_event_code) mappedData.test_event_code = eventData.test_event_code;

  if (data.serverDataList) {
    data.serverDataList.forEach((d) => {
      if (isValidValue(d.value)) {
        mappedData[d.name] = d.value;
      }
    });
  }

  return mappedData;
}

function isHashed(value) {
  if (!value) {
    return false;
  }

  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function hashData(value) {
  if (!value) {
    return value;
  }

  const type = getType(value);

  if (type === 'undefined' || value === 'undefined') {
    return undefined;
  }

  if (type === 'object') {
    return value.map((val) => {
      return hashData(val);
    });
  }

  if (isHashed(value)) {
    return value;
  }

  return sha256Sync(makeString(value).trim().toLowerCase(), {
    outputEncoding: 'hex'
  });
}

function hashDataIfNeeded(mappedData) {
  const fieldsToHash = ['em', 'ph', 'fn', 'ln', 'ge', 'ct', 'st', 'zp', 'country', 'external_id'];
  for (let key in mappedData.user_data) {
    if (fieldsToHash.indexOf(key) !== -1) {
      mappedData.user_data[key] = hashData(mappedData.user_data[key]);
    }
  }
  return mappedData;
}

function addUserData(eventData, mappedData) {
  let address = {};
  let user_data = {};
  if (getType(eventData.user_data) === 'object') {
    user_data = eventData.user_data;
    const addressType = getType(user_data.address);
    if (addressType === 'object' || addressType === 'array') {
      address = user_data.address[0] || user_data.address;
    }
  }
  const click_id = getClickId();
  if (click_id) mappedData.user_data.sc_click_id = click_id;
  const scid = getSCID();
  if (scid) mappedData.user_data.sc_cookie1 = scid;

  if (eventData.anon_id) mappedData.user_data.anon_id = eventData.anon_id;
  if (eventData.madid) mappedData.user_data.madid = eventData.madid;
  if (eventData.download_id) mappedData.user_data.download_id = eventData.download_id;
  if (eventData.user_agent) mappedData.user_data.client_user_agent = eventData.user_agent;
  if (eventData.idfv) mappedData.user_data.idfv = eventData.idfv;

  if (eventData.external_id) mappedData.user_data.external_id = eventData.external_id;
  else if (eventData.user_id) mappedData.user_data.external_id = eventData.user_id;
  else if (eventData.userId) mappedData.user_data.external_id = eventData.userId;

  if (eventData.subscription_id) mappedData.user_data.subscription_id = eventData.subscription_id;
  else if (eventData.subscriptionId) mappedData.user_data.subscription_id = eventData.subscriptionId;

  if (eventData.lead_id) mappedData.user_data.lead_id = eventData.lead_id;
  else if (eventData.leadId) mappedData.user_data.lead_id = eventData.leadId;

  if (eventData.lastName) mappedData.user_data.ln = eventData.lastName;
  else if (eventData.LastName) mappedData.user_data.ln = eventData.LastName;
  else if (eventData.nameLast) mappedData.user_data.ln = eventData.nameLast;
  else if (eventData.last_name) mappedData.user_data.ln = eventData.last_name;
  else if (user_data.last_name) mappedData.user_data.ln = user_data.last_name;
  else if (address.last_name) mappedData.user_data.ln = address.last_name;

  if (eventData.firstName) mappedData.user_data.fn = eventData.firstName;
  else if (eventData.FirstName) mappedData.user_data.fn = eventData.FirstName;
  else if (eventData.nameFirst) mappedData.user_data.fn = eventData.nameFirst;
  else if (eventData.first_name) mappedData.user_data.fn = eventData.first_name;
  else if (user_data.first_name) mappedData.user_data.fn = user_data.first_name;
  else if (address.first_name) mappedData.user_data.fn = address.first_name;

  if (eventData.email) mappedData.user_data.em = eventData.email;
  else if (user_data.email_address) mappedData.user_data.em = user_data.email_address;
  else if (user_data.email) mappedData.user_data.em = user_data.email;

  if (eventData.phone) mappedData.user_data.ph = eventData.phone;
  else if (user_data.phone_number) mappedData.user_data.ph = user_data.phone_number;

  if (eventData.city) mappedData.user_data.ct = eventData.city;
  else if (address.city) mappedData.user_data.ct = address.city;

  if (eventData.state) mappedData.user_data.st = eventData.state;
  else if (eventData.region) mappedData.user_data.st = eventData.region;
  else if (user_data.region) mappedData.user_data.st = user_data.region;
  else if (address.region) mappedData.user_data.st = address.region;

  if (eventData.zip) mappedData.user_data.zp = eventData.zip;
  else if (eventData.postal_code) mappedData.user_data.zp = eventData.postal_code;
  else if (user_data.postal_code) mappedData.user_data.zp = user_data.postal_code;
  else if (address.postal_code) mappedData.user_data.zp = address.postal_code;

  if (eventData.countryCode) mappedData.user_data.country = eventData.countryCode;
  else if (eventData.country) mappedData.user_data.country = eventData.country;
  else if (user_data.country) mappedData.user_data.country = user_data.country;
  else if (address.country) mappedData.user_data.country = address.country;

  if (eventData.gender) mappedData.user_data.ge = eventData.gender;

  if (eventData.ip_override) {
    mappedData.user_data.client_ip_address = eventData.ip_override.split(' ').join('').split(',')[0];
  }

  if (data.userDataList) {
    data.userDataList.forEach((d) => {
      if (isValidValue(d.value)) {
        mappedData.user_data[d.name] = d.value;
      }
    });
  }

  return mappedData;
}

function createUUID() {
  let len = 36;
  let chars = '0123456789abcdef'.split('');
  let uuid = '';

  for (var i = 0; i < len; i++) {
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      uuid += '-';
    } else if (i == 14) {
      uuid += '4';
    } else {
      uuid += chars[generateRandom(0, chars.length - 1)];
    }
  }
  return uuid;
}

function getSCID() {
  const scid = getCookieValues('_scid')[0] || commonCookie._scid || eventData._scid || eventData.scid;
  if (scid) {
    return scid;
  }

  if (data.eventConversionType === 'WEB' && !data.notSetBrowserIdCookie) {
    return createUUID();
  }

  return undefined;
}

function getClickId() {
  if (eventData.click_id) return eventData.click_id;
  const parsedUrl = parseUrl(url);
  if (parsedUrl && parsedUrl.searchParams.ScCid) {
    return parsedUrl.searchParams.ScCid;
  }
  return getCookieValues('_scclid')[0] || commonCookie._scclid;
}

function isConsentGivenOrNotRequired() {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '';
}

function determinateIsLoggingEnabled() {
  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}