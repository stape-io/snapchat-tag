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

const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');

const eventData = getAllEventData();

sendTrackRequest(mapEvent(eventData, data));

function sendTrackRequest(postBody) {
    const postUrl = 'https://tr.snapchat.com/v2/conversion';

    if (isLoggingEnabled) {
        logToConsole(JSON.stringify({
            'Name': 'Snapchat',
            'Type': 'Request',
            'TraceId': traceId,
            'EventName': postBody.event_type,
            'RequestMethod': 'POST',
            'RequestUrl': postUrl,
            'RequestBody': postBody,
        }));
    }

    sendHttpRequest(postUrl, (statusCode, headers, body) => {
        if (isLoggingEnabled) {
            logToConsole(JSON.stringify({
                'Name': 'Snapchat',
                'Type': 'Response',
                'TraceId': traceId,
                'EventName': postBody.event_type,
                'ResponseStatusCode': statusCode,
                'ResponseHeaders': headers,
                'ResponseBody': body,
            }));
        }

        if (statusCode >= 200 && statusCode < 400) {
            if (postBody.uuid_c1) {
                setCookie('_scid', postBody.uuid_c1, {
                    domain: 'auto',
                    path: '/',
                    samesite: 'Lax',
                    secure: true,
                    'max-age': 31536000, // 1 year
                    httpOnly: !!data.useHttpOnlyCookie
                });
            }

            data.gtmOnSuccess();
        } else {
            data.gtmOnFailure();
        }
    }, {headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.apiToken}, method: 'POST'}, JSON.stringify(postBody));
}

function getEventName(eventData, data) {
    if (data.eventType === 'inherit') {
        let eventName = eventData.event_name;

        let gaToEventName = {
            'page_view': 'PAGE_VIEW',
            "gtm.dom": "PAGE_VIEW",
            'add_to_cart': 'ADD_CART',
            'sign_up': 'SIGN_UP',
            'purchase': 'PURCHASE',
            'view_item': 'VIEW_CONTENT',
            'add_to_wishlist': 'ADD_TO_WISHLIST',
            'begin_checkout': 'START_CHECKOUT',
            'add_payment_info': 'ADD_BILLING',
            'view_item_list': 'LIST_VIEW',
            'tutorial_complete': 'COMPLETE_TUTORIAL',
            'search': 'SEARCH',
            'generate_lead': 'SIGN_UP',

            'contact': 'CUSTOM_EVENT_2',
            'customize_product': 'CUSTOM_EVENT_3',
            'donate': 'SPENT_CREDITS',
            'find_location': 'SEARCH',
            'schedule': 'CUSTOM_EVENT_4',
            'start_trial': 'START_TRIAL',
            'submit_application': 'SUBSCRIBE',
            'subscribe': 'SUBSCRIBE',

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
        "version": '2.0',
        "event_type": getEventName(eventData, data),
        "event_tag": data.eventTag,
        "event_conversion_type": data.eventConversionType,
        "pixel_id": data.pixelId,
        "timestamp": Math.round(getTimestampMillis() / 1000),
        "page_url": eventData.page_location || getRequestHeader('referer'),
        "user_agent": eventData.user_agent,
        "hashed_ip_address": eventData.ip_override,
        "integration": "gtmss",
        "uuid_c1": getSCID()
    };

    if (data.eventId) mappedData.client_dedup_id = data.eventId;
    else if (eventData.client_dedup_id) mappedData.client_dedup_id = eventData.client_dedup_id;

    mappedData = addUserData(eventData, mappedData);
    mappedData = addPropertiesData(eventData, mappedData);
    mappedData = hashDataIfNeeded(mappedData);

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
        return value.map(val => {
            return hashData(val);
        });
    }

    if (isHashed(value)) {
        return value;
    }

    return sha256Sync(makeString(value).trim().toLowerCase(), {outputEncoding: 'hex'});
}

function hashDataIfNeeded(mappedData) {
    for (let key in mappedData) {
        if (key === 'hashed_email' || key === 'hashed_phone_number' || key === 'hashed_ip_address' || key === 'hashed_mobile_ad_id' || key === 'hashed_idfv') {
            mappedData[key] = hashData(mappedData[key]);
        }
    }

    return mappedData;
}

function addPropertiesData(eventData, mappedData) {
    if (eventData['x-ga-mp1-ev']) mappedData.price = eventData['x-ga-mp1-ev'];
    else if (eventData['x-ga-mp1-tr']) mappedData.price = eventData['x-ga-mp1-tr'];
    else if (eventData.value) mappedData.price = eventData.value;

    if (eventData.item_category) mappedData.item_category = eventData.item_category;
    else if (eventData.category) mappedData.item_category = eventData.category;

    if (eventData.query) mappedData.search_string = eventData.query;
    else if (eventData.search_string) mappedData.search_string = eventData.search_string;

    if (eventData.transaction_id) mappedData.transaction_id = eventData.transaction_id;
    if (eventData.currency) mappedData.currency = eventData.currency;
    if (eventData.description) mappedData.description = eventData.description;

    if (eventData.event_tag) mappedData.event_tag = eventData.event_tag;
    if (eventData.item_ids) mappedData.item_ids = eventData.item_ids;
    if (eventData.number_items) mappedData.number_items = eventData.number_items;
    if (eventData.price) mappedData.price = eventData.price;
    if (eventData.level) mappedData.level = eventData.level;
    if (eventData.data_use) mappedData.data_use = eventData.data_use;
    if (eventData.sign_up_method) mappedData.sign_up_method = eventData.sign_up_method;


    if (eventData.items && eventData.items[0]) {
        let items = [];

        eventData.items.forEach((d,i) => {
            let itemId = {};

            if (d.item_id) itemId = d.item_id;
            else if (d.id) itemId = d.id;

            items.push(itemId);
        });

        mappedData.item_ids = items.join(';');
    }

    if (data.customDataList) {
        data.customDataList.forEach(d => {
            mappedData[d.name] = d.value;
        });
    }

    return mappedData;
}

function addUserData(eventData, mappedData) {
    if (eventData.email) mappedData.hashed_email = eventData.email;
    else if (eventData.user_data && eventData.user_data.email_address) mappedData.hashed_email = eventData.user_data.email_address;

    if (eventData.phone) mappedData.hashed_phone_number = eventData.phone;
    else if (eventData.user_data && eventData.user_data.phone_number) mappedData.hashed_phone_number = eventData.user_data.phone_number;

    if (data.userDataList) {
        data.userDataList.forEach(d => {
            mappedData[d.name] = d.value;
        });
    }

    return mappedData;
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

function createUUID() {
    let len = 36;
    let chars = '0123456789abcdef'.split('');
    let uuid = "";

    for (var i = 0; i < len; i++) {
        if (i == 8 || i == 13 || i == 18 || i == 23) {
            uuid += '-';
        } else if (i == 14) {
            uuid += '4';
        } else {
            uuid += chars[generateRandom(0, chars.length-1)];
        }
    }
    return uuid;
}

function getSCID() {
    const scidCookie = getCookieValues('_scid')[0];

    if (scidCookie) {
        return scidCookie;
    }

    if (eventData._scid) {
        return eventData._scid;
    }

    return createUUID();
}
