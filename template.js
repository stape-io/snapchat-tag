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

const containerVersion = getContainerVersion();
const isDebug = containerVersion.debugMode;
const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = getRequestHeader('trace-id');

const eventData = getAllEventData();

let scid = getCookieValues('_scid')[0];
if (!scid) scid = eventData._scid;

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
            if (scid) {
                setCookie('_scid', scid, {
                    domain: 'auto',
                    path: '/',
                    samesite: 'Lax',
                    secure: true,
                    'max-age': 31536000, // 1 year
                    httpOnly: false
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
            'add_payment_info': 'ADD_BILLING',
            'add_to_cart': 'ADD_CART',
            'add_to_wishlist': 'ADD_TO_WISHLIST',
            'sign_up': 'SIGN_UP',
            'begin_checkout': 'START_CHECKOUT',
            'generate_lead': 'CUSTOM_EVENT_1',
            'purchase': 'PURCHASE',
            'search': 'SEARCH',
            'view_item': 'VIEW_CONTENT',

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
        "hashed_ip_address": eventData.ip_override
    };

    if (scid) mappedData.uuid_c1 = scid;
    if (data.eventId) mappedData.client_dedup_id = data.eventId;

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

    if (eventData.transaction_id) mappedData.transaction_id = eventData.transaction_id;
    if (eventData.currency) mappedData.currency = eventData.currency;
    if (eventData.description) mappedData.description = eventData.description;
    if (eventData.query) mappedData.search_string = eventData.query;


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
