const encodeUriComponent = require('encodeUriComponent');
const generateRandom = require('generateRandom');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const Math = require('Math');
const Object = require('Object');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');
const sha256Sync = require('sha256Sync');

/*==============================================================================
==============================================================================*/

const API_VERSION = '3';
const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

const pixelOrAppId = data.eventConversionType === 'MOBILE_APP' ? data.snapAppId : data.pixelId;
if (!pixelOrAppId || !data.accessToken) {
  return data.gtmOnFailure();
}

const mappedEvent = mapEvent(data, eventData);
setIDsCookies(data, mappedEvent.user_data.sc_click_id, mappedEvent.user_data.sc_cookie1);
sendTrackRequest(mappedEvent);

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
Vendor related functions
==============================================================================*/

function setIDsCookies(data, ssclid, scid) {
  const cookieOptions = {
    domain: 'auto',
    path: '/',
    samesite: 'Lax',
    secure: true,
    'max-age': 31536000, // 1 year
    httpOnly: !!data.useHttpOnlyCookie
  };

  if (ssclid && !data.notSetClickIdCookie) {
    setCookie('_scclid', ssclid, cookieOptions);
  }

  if (scid && !data.notSetBrowserIdCookie) {
    setCookie('_scid', scid, cookieOptions);
  }
}

function sendTrackRequest(mappedEvent) {
  const requestUrl = getPostUrl();
  const requestBody = {
    data: [mappedEvent]
  };

  sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      if (!data.useOptimisticScenario) {
        return statusCode >= 200 && statusCode < 400 ? data.gtmOnSuccess() : data.gtmOnFailure();
      }
    },
    {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST'
    },
    JSON.stringify(requestBody)
  );
}

function getPostUrl() {
  let postUrl =
    'https://tr.snapchat.com/v' + API_VERSION + '/' + encodeUriComponent(pixelOrAppId) + '/events';
  if (data.validate) {
    postUrl = postUrl + '/validate';
  }
  postUrl = postUrl + '?access_token=' + data.accessToken;
  return postUrl;
}

function getEventName(eventData, data) {
  if (data.eventType === 'inherit') {
    const eventName = eventData.event_name;

    const gaToEventName = {
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

function mapEvent(data, eventData) {
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
  const autoMapEnabled = data.hasOwnProperty('autoMapCustomData') ? data.autoMapCustomData : true; // To avoid a breaking change.

  if (autoMapEnabled) {
    let items;
    if (getType(eventData.items) === 'array' && eventData.items.length) items = eventData.items;
    else if (
      getType(eventData.ecommerce) === 'object' &&
      getType(eventData.ecommerce.items) === 'array' &&
      eventData.ecommerce.items.length
    ) {
      items = eventData.ecommerce.items;
    }

    let currencyFromItems = '';
    let valueFromItems = 0;

    if (items && items[0]) {
      mappedData.custom_data.contents = [];
      mappedData.custom_data.content_type = 'product';
      currencyFromItems = items[0].currency;
      mappedData.custom_data.num_items = items.length;

      if (!items[1]) {
        if (items[0].item_name) mappedData.custom_data.content_name = items[0].item_name;
        if (items[0].item_category)
          mappedData.custom_data.content_category = items[0].item_category;
        if (items[0].item_id) mappedData.custom_data.content_ids = items[0].item_id;

        if (items[0].price) {
          mappedData.custom_data.value = items[0].quantity
            ? items[0].quantity * items[0].price
            : items[0].price;
        }
      }

      const itemIdKey = data.itemIdKey ? data.itemIdKey : 'item_id';
      items.forEach((d, i) => {
        const content = {};
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

    const value = eventData['x-ga-mp1-ev'] || eventData['x-ga-mp1-tr'] || eventData.value;
    if (value) mappedData.custom_data.value = value;

    const currency = eventData.currency || currencyFromItems;
    if (currency) mappedData.custom_data.currency = currency;

    if (eventData.search_term) mappedData.custom_data.search_string = eventData.search_term;

    if (eventData.transaction_id) mappedData.custom_data.order_id = eventData.transaction_id;

    if (mappedData.event_name === 'Purchase') {
      if (!mappedData.custom_data.currency) mappedData.custom_data.currency = 'USD';
      if (!mappedData.custom_data.value)
        mappedData.custom_data.value = valueFromItems ? valueFromItems : 0;
    }

    if (eventData.predicted_ltv) mappedData.custom_data.predicted_ltv = eventData.predicted_ltv;
    if (eventData.sign_up_method) mappedData.custom_data.sign_up_method = eventData.sign_up_method;
    if (eventData.brands) mappedData.custom_data.brands = eventData.brands;
  }

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

  const autoMapEnabled = data.hasOwnProperty('autoMapAppData') ? data.autoMapAppData : true; // To avoid a breaking change.

  const appData = eventData.app_data || {};
  mappedData.app_data = {};

  const appId = data.appId || (autoMapEnabled ? appData.app_id : undefined);
  if (appId) mappedData.app_data.app_id = appId;

  if (autoMapEnabled) {
    if (appData.extinfo) mappedData.app_data.extinfo = appData.extinfo;

    if (appData.advertiser_tracking_enabled) {
      mappedData.app_data.advertiser_tracking_enabled = appData.advertiser_tracking_enabled;
    }
  }

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
  const autoMapEnabled = data.hasOwnProperty('autoMapServerData') ? data.autoMapServerData : true; // To avoid a breaking change.

  mappedData.event_name = getEventName(eventData, data);
  mappedData.action_source = data.eventConversionType;
  mappedData.test_event_code = data.testEventCode;
  mappedData.integration = 'stape';

  if (autoMapEnabled) {
    mappedData.event_time = Math.round(getTimestampMillis() / 1000);

    if (data.eventConversionType === 'WEB') {
      mappedData.event_source_url = eventData.page_location || getRequestHeader('referer');
    }

    const eventId = eventData.event_id || eventData.transaction_id;
    if (eventId) mappedData.event_id = eventId;

    if (eventData.test_event_code) mappedData.test_event_code = eventData.test_event_code;
  }

  if (data.serverDataList) {
    data.serverDataList.forEach((d) => {
      if (isValidValue(d.value)) {
        mappedData[d.name] = d.value;
      }
    });
  }

  return mappedData;
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
  const autoMapEnabled = data.hasOwnProperty('autoMapUserData') ? data.autoMapUserData : true; // To avoid a breaking change.

  if (autoMapEnabled) {
    let address = {};
    let user_data = {};
    if (getType(eventData.user_data) === 'object') {
      user_data = eventData.user_data;
      const addressType = getType(user_data.address);
      if (addressType === 'object' || addressType === 'array') {
        address = user_data.address[0] || user_data.address;
      }
    }

    const clickId = getClickId(eventData);
    if (clickId) mappedData.user_data.sc_click_id = clickId;
    const scid = getSCID(eventData);
    if (scid) mappedData.user_data.sc_cookie1 = scid;

    if (eventData.anon_id) mappedData.user_data.anon_id = eventData.anon_id;
    if (eventData.madid) mappedData.user_data.madid = eventData.madid;
    if (eventData.download_id) mappedData.user_data.download_id = eventData.download_id;
    if (eventData.user_agent) mappedData.user_data.client_user_agent = eventData.user_agent;
    if (eventData.idfv) mappedData.user_data.idfv = eventData.idfv;

    const externalId = eventData.external_id || eventData.user_id || eventData.userId;
    if (externalId) mappedData.user_data.external_id = externalId;

    const subscriptionId = eventData.subscription_id || eventData.subscriptionId;
    if (subscriptionId) mappedData.user_data.subscription_id = subscriptionId;

    const leadId = eventData.lead_id || eventData.leadId;
    if (leadId) mappedData.user_data.lead_id = leadId;

    const lastName =
      eventData.lastName ||
      eventData.LastName ||
      eventData.nameLast ||
      eventData.last_name ||
      user_data.last_name ||
      address.last_name;
    if (lastName) mappedData.user_data.ln = lastName;

    const firstName =
      eventData.firstName ||
      eventData.FirstName ||
      eventData.nameFirst ||
      eventData.first_name ||
      user_data.first_name ||
      address.first_name;
    if (firstName) mappedData.user_data.fn = firstName;

    const email = eventData.email || user_data.email_address || user_data.email;
    if (email) mappedData.user_data.em = email;

    const phone = eventData.phone || user_data.phone_number;
    if (phone) mappedData.user_data.ph = phone;

    const city = eventData.city || address.city;
    if (city) mappedData.user_data.ct = city;

    const state = eventData.state || eventData.region || user_data.region || address.region;
    if (state) mappedData.user_data.st = state;

    const zip =
      eventData.zip || eventData.postal_code || user_data.postal_code || address.postal_code;
    if (zip) mappedData.user_data.zp = zip;

    const country =
      eventData.countryCode || eventData.country || user_data.country || address.country;
    if (country) mappedData.user_data.country = country;

    if (eventData.gender) mappedData.user_data.ge = eventData.gender;

    if (eventData.ip_override) {
      mappedData.user_data.client_ip_address = eventData.ip_override
        .split(' ')
        .join('')
        .split(',')[0];
    }
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
  const len = 36;
  const chars = '0123456789abcdef'.split('');
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

function getSCID(eventData) {
  const scid =
    getCookieValues('_scid')[0] ||
    (eventData.common_cookie || {})._scid ||
    eventData._scid ||
    eventData.scid;

  if (scid) {
    return scid;
  }

  if (data.eventConversionType === 'WEB' && !data.notSetBrowserIdCookie) {
    return createUUID();
  }

  return undefined;
}

function getClickId(eventData) {
  let clickId =
    getCookieValues('_scclid')[0] ||
    (eventData.common_cookie || {})._scclid ||
    eventData.click_id ||
    eventData._scclid ||
    eventData.scclid;

  const url = getUrl(eventData);
  if (url) {
    const parsedUrl = parseUrl(url);
    if (parsedUrl && parsedUrl.searchParams.ScCid) {
      clickId = parsedUrl.searchParams.ScCid;
    }
  }

  return clickId;
}

function hashData(value) {
  if (!value) return value;

  const type = getType(value);

  if (value === 'undefined' || value === 'null') return undefined;

  if (type === 'array') {
    return value.map((val) => hashData(val));
  }

  if (type === 'object') {
    return Object.keys(value).reduce((acc, val) => {
      acc[val] = hashData(value[val]);
      return acc;
    }, {});
  }

  if (isHashed(value)) return value;

  return sha256Sync(makeString(value).trim().toLowerCase(), {
    outputEncoding: 'hex'
  });
}

/*==============================================================================
Helpers
==============================================================================*/

function getUrl(eventData) {
  return eventData.page_location || eventData.page_referrer || getRequestHeader('referer');
}

function shouldExitEarly(data, eventData) {
  if (!isConsentGivenOrNotRequired(data, eventData)) {
    data.gtmOnSuccess();
    return true;
  }

  const url = getUrl(eventData);
  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();
    return true;
  }
}

function isHashed(value) {
  if (!value) return false;
  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '' && value === value;
}
