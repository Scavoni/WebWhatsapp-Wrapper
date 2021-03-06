/**
 * This script contains WAPI functions that need to be run in the context of the webpage
 */

/**
 * Auto discovery the webpack object references of instances that contains all functions used by the WAPI
 * functions and creates the Store object.
 */
if (!window.Store) {
    window.created = false;
    window.ToProcessMedia = [];
    window.ProcessedMedia = [];
    (function() {
        function getStore(modules) {
            let foundCount = 0;
            let neededObjects = [
                { id: "Store", conditions: (module) => (module.Chat && module.Msg) ? module : null },
                { id: "Wap", conditions: (module) => (module.createGroup) ? module : null },
                { id: "MediaCollection", conditions: (module) => (module.default && module.default.prototype && module.default.prototype.processFiles !== undefined) ? module.default : null},
                { id: "WapDelete", conditions: (module) => (module.sendConversationDelete && module.sendConversationDelete.length == 2) ? module : null },
                { id: "Conn", conditions: (module) => (module.default && module.default.ref && module.default.refTTL) ? module.default : null },
                { id: "WapQuery", conditions: (module) => (module.queryExist) ? module : null },
                { id: "ProtoConstructor", conditions: (module) => (module.prototype && module.prototype.constructor.toString().indexOf('binaryProtocol deprecated version') >= 0) ? module : null },
                { id: "CryptoLib", conditions: (module) => (module.decryptE2EMedia) ? module : null }
            ];

            for (let idx in modules) {
                if ((typeof modules[idx] === "object") && (modules[idx] !== null)) {
                    let first = Object.values(modules[idx])[0];
                    if ((typeof first === "object") && (first.exports)) {
                        for (let idx2 in modules[idx]) {
                            let module = modules(idx2);
                            if (!module) {
                                continue;
                            }

                            neededObjects.forEach((needObj) => {
                                if(!needObj.conditions || needObj.foundedModule) return;
                                let neededModule = needObj.conditions(module);
                                if(neededModule !== null) {
                                    foundCount++;
                                    needObj.foundedModule = neededModule;
                                }
                            });

                            if(foundCount == neededObjects.length) {
                                break;
                            }
                        }

                        let neededStore = neededObjects.find((needObj) => needObj.id === "Store");
                        window.Store = neededStore.foundedModule ? neededStore.foundedModule : {};
                        neededObjects.splice(neededObjects.indexOf(neededStore), 1);
                        neededObjects.forEach((needObj) => {
                            if(needObj.foundedModule) {
                                window.Store[needObj.id] = needObj.foundedModule;
                            }
                        });

                        return window.Store;
                    }
                }
            }
        }

        webpackJsonp([], {'parasite': (x, y, z) => getStore(z)}, 'parasite');
    })();
}
window.WAPI = {
    lastRead: {}
};

window.WAPI._serializeRawObj = (obj) => {
    if (obj) {
        return obj.toJSON();
    }
    return {}
};

/**
 * Serializes a chat object
 *
 * @param rawChat Chat object
 * @returns {{}}
 */

window.WAPI._serializeChatObj = (obj) => {
    if (obj == undefined) {
        return null;
    }

    return Object.assign(window.WAPI._serializeRawObj(obj), {
        kind: obj.kind,
        isGroup: obj.isGroup,
        contact: obj['contact'] ? window.WAPI._serializeContactObj(obj['contact']) : null,
        groupMetadata: obj["groupMetadata"] ? window.WAPI._serializeRawObj(obj["groupMetadata"]) : null,
        presence: obj["presence"] ? window.WAPI._serializeRawObj(obj["presence"]) : null,
        msgs: null
    });
};

window.WAPI._serializeContactObj = (obj) => {
    if (obj == undefined) {
        return null;
    }

    return Object.assign(window.WAPI._serializeRawObj(obj), {
        formattedName: obj.formattedName,
        isHighLevelVerified: obj.isHighLevelVerified,
        isMe: obj.isMe,
        isMyContact: obj.isMyContact,
        isPSA: obj.isPSA,
        isUser: obj.isUser,
        isVerified: obj.isVerified,
        isWAContact: obj.isWAContact,
        profilePicThumbObj: obj.profilePicThumb ? WAPI._serializeRawObj(obj.profilePicThumb) : {},
        statusMute: obj.statusMute,
        msgs: null
    });
};

window.WAPI._serializeMessageObj = (obj) => {
    if (obj == undefined) {
        return null;
    }

    return Object.assign(window.WAPI._serializeRawObj(obj), {
        id: obj.id._serialized,
        sender: obj["senderObj"] ? WAPI._serializeContactObj(obj["senderObj"]) : null,
        timestamp: obj["t"],
        content: obj["body"],
        isGroupMsg: obj.isGroupMsg,
        isLink: obj.isLink,
        isMMS: obj.isMMS,
        isMedia: obj.isMedia,
        isNotification: obj.isNotification,
        isPSA: obj.isPSA,
        type: obj.type,
        chat: WAPI._serializeChatObj(obj['chat']),
        chatId: obj.id.remote,
        quotedMsgObj: WAPI._serializeMessageObj(obj['_quotedMsgObj']),
        mediaData: window.WAPI._serializeRawObj(obj['mediaData'])
    });
};

window.WAPI._serializeNumberStatusObj = (obj) => {
    if (obj == undefined) {
        return null;
    }

    return Object.assign({}, {
        id: obj.jid,
        status: obj.status,
        isBusiness: (obj.biz === true),
        canReceiveMessage: (obj.status === 200)
    });
};

window.WAPI.createGroup = function (name, contactsId) {
    if (!Array.isArray(contactsId)) {
        contactsId = [contactsId];
    }
    Store.Wap.setSubProtocol(10);
    return window.Store.Wap.createGroup(name, contactsId);
};

window.WAPI.getAllContacts = function (done) {
    const contacts = window.Store.Contact.map((contact) => WAPI._serializeContactObj(contact));

    if (done !== undefined) {
        done(contacts);
    } else {
        return contacts;
    }
};

/**
 * Fetches all contact objects from store, filters them
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of contacts
 */
window.WAPI.getMyContacts = function (done) {
    const contacts = window.Store.Contact.filter((contact) => contact.isMyContact === true).map((contact) => WAPI._serializeContactObj(contact));

    if (done !== undefined) {
        done(contacts);
    } else {
        return contacts;
    }
};

/**
 * Fetches contact object from store by ID
 *
 * @param id ID of contact
 * @param done Optional callback function for async execution
 * @returns {T|*} Contact object
 */
window.WAPI.getContact = function (id, done) {
    const found = window.Store.Contact.get(id);

    if (done !== undefined) {
        done(window.WAPI._serializeContactObj(found));
    } else {
        return window.WAPI._serializeContactObj(found);
    }
};

window.WAPI.getChatsModel = function (done) {
    const chats = window.Store.Chat.models;

    if (!!done) {
        done(chats);
    } else {
        return chats;
    }
};

/**
 * Fetches all chat objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of chats
 */
window.WAPI.getAllChats = function (done) {
    const chats = window.Store.Chat.map((chat) => WAPI._serializeChatObj(chat));

    if (done !== undefined) {
        done(chats);
    } else {
        return chats;
    }
};

window.WAPI.haveNewMsg = function (chat) {
    return chat.unreadCount > 0;
};

window.WAPI.getAllChatsWithNewMsg = function (done) {
    const chats = window.Store.Chat.filter(window.WAPI.haveNewMsg).map((chat) => WAPI._serializeChatObj(chat));

    if (done !== undefined) {
        done(chats);
    } else {
        return chats;
    }
};

/**
 * Fetches all chat IDs from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of chat id's
 */
window.WAPI.getAllChatIds = function (done) {
    const chatIds = window.Store.Chat.map((chat) => chat.id);

    if (done !== undefined) {
        done(chatIds);
    } else {
        return chats;
    }
};

/**
 * Fetches all groups objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of chats
 */
window.WAPI.getAllGroups = function (done) {
    const groups = window.Store.Chat.filter((chat) => chat.isGroup);

    if (done !== undefined) {
        done(groups);
    } else {
        return groups;
    }
};

/**
 * Fetches chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns {T|*} Chat object
 */
window.WAPI.getChat = function (id, done) {
    const found = window.Store.Chat.get(id);
    if (done !== undefined) {
        done(found);
    } else {
        return found;
    }
};

window.WAPI.getChatByName = function (name, done) {
    const found = Store.Chat.models.find((chat) => chat.__x_name === name);
    if (done !== undefined) {
        done(found);
    } else {
        return found;
    }
};

window.WAPI.sendImageFromDatabasePicBot = function (picId, chatId, caption) {
    var chatDatabase = window.WAPI.getChatByName('DATABASEPICBOT');
    var msgWithImg = chatDatabase.msgs.find((msg) => msg.caption == picId);
    if (msgWithImg === undefined) {
        return false;
    }
    var chatSend = WAPI.getChat(chatId);
    if (chatSend === undefined) {
        return false;
    }
    const oldCaption = msgWithImg.caption;
    msgWithImg.id.id = window.WAPI.getNewId();
    msgWithImg.id.remote = chatId;
    msgWithImg.t = Math.ceil(new Date().getTime() / 1000);
    msgWithImg.to = chatId;
    if (caption !== undefined && caption !== '') {
        msgWithImg.caption = caption;
    } else {
        msgWithImg.caption = '';
    }
    msgWithImg.collection.send(msgWithImg).then(function (e) {
        msgWithImg.caption = oldCaption;
    });

    return true;
};

window.WAPI.sendMessageWithThumb = function (thumb, url, title, description, chatId) {
    var chatSend = WAPI.getChat(chatId);
    if (chatSend === undefined) {
        return false;
    }
    var msgWithImg = chatSend.createMessageFromText(".");
    msgWithImg.hasLink = title;
    msgWithImg.body = description + '\n                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ' + url;
    msgWithImg.isLink = title;
    msgWithImg.description = description;
    msgWithImg.subtype = 'url';
    msgWithImg.title = title;
    msgWithImg.thumbnail = thumb;
    return chatSend.addAndSendMsg(msgWithImg);

    return true;
};

window.WAPI.getNewId = function () {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 20; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

window.WAPI.getChatById = function (id, done) {
    let found = window.WAPI.getChat(id);
    if (found) {
        found = WAPI._serializeChatObj(found);
    } else {
        found = false;
    }

    if (done !== undefined) {
        done(found);
    } else {
        return found;
    }
};

/**
 * I return all unread messages from an asked chat and mark them as read.
 *
 * :param id: chat id
 * :type  id: string
 *
 * :param includeMe: indicates if user messages have to be included
 * :type  includeMe: boolean
 *
 * :param includeNotifications: indicates if notifications have to be included
 * :type  includeNotifications: boolean
 *
 * :param done: callback passed by selenium
 * :type  done: function
 *
 * :returns: list of unread messages from asked chat
 * :rtype: object
 */
window.WAPI.getUnreadMessagesInChat = function (id, includeMe, includeNotifications, done) {
    // get chat and its messages
    let chat = WAPI.getChat(id);
    let messages = chat.msgs.models;

    // initialize result list
    let output = [];

    // look for unread messages, newest is at the end of array
    for (let i = messages.length - 1; i >= 0; i--)
    {
        // system message: skip it
        if (i === "remove") {
            continue;
        }

        // get message
        let messageObj = messages[i];

        // found a read message: stop looking for others
        if (typeof (messageObj.isNewMsg) !== "boolean" || messageObj.isNewMsg === false) {
            continue;
        } else {
            messageObj.isNewMsg = false;
            // process it
            let message = WAPI.processMessageObj(messageObj,
                    includeMe,
                    includeNotifications);

            // save processed message on result list
            if (message)
                output.push(message);
        }
    }
    // callback was passed: run it
    if (done !== undefined) {
        done(output);
    }

    // return result list
    return output;
};

/**
 * Load more messages in chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns None
 */
window.WAPI.loadEarlierMessages = function (id, done) {
    const found = window.Store.Chat.get(id);
    if (done !== undefined) {
        found.loadEarlierMsgs().then(function () {
            done()
        });
    } else {
        found.loadEarlierMsgs();
    }
};

/**
 * Load more messages in chat object from store by ID
 *
 * @param id ID of chat
 * @param done Optional callback function for async execution
 * @returns None
 */

window.WAPI.loadAllEarlierMessages = function (id, done) {
    const found = window.Store.Chat.get(id);
    x = function () {
        if (!found.msgs.msgLoadState.noEarlierMsgs) {
            found.loadEarlierMsgs().then(x);
        } else if (done) {
            done();
        }
    };
    x();
};

window.WAPI.asyncLoadAllEarlierMessages = function (id, done) {
    done();
    window.WAPI.loadAllEarlierMessages(id);
};

window.WAPI.areAllMessagesLoaded = function (id, done) {
    const found = window.Store.Chat.get(id);
    if (!found.msgs.msgLoadState.noEarlierMsgs) {
        if (done) {
            done(false);
        } else {
            return false
        }
    }
    if (done) {
        done(true);
    } else {
        return true
    }
};

/**
 * Load more messages in chat object from store by ID till a particular date
 *
 * @param id ID of chat
 * @param lastMessage UTC timestamp of last message to be loaded
 * @param done Optional callback function for async execution
 * @returns None
 */
window.WAPI.loadEarlierMessagesTillDate = function (id, lastMessage, done) {
    const found = window.Store.Chat.get(id);
    x = function () {
        if (found.msgs.models[0].t > lastMessage) {
            found.loadEarlierMsgs().then(x);
        } else {
            done();
        }
    };
    x();
};

/**
 * Fetches all group metadata objects from store
 *
 * @param done Optional callback function for async execution
 * @returns {Array|*} List of group metadata
 */
window.WAPI.getAllGroupMetadata = function (done) {
    const groupData = window.Store.GroupMetadata.map((groupData) => groupData.all);

    if (done !== undefined) {
        done(groupData);
    } else {
        return groupData;
    }
};

/**
 * Fetches group metadata object from store by ID
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {T|*} Group metadata object
 */
window.WAPI.getGroupMetadata = async function (id, done) {
    let output = window.Store.GroupMetadata.get(id);

    if (output !== undefined) {
        if (output.stale) {
            await output.update();
        }
    }

    if (done !== undefined) {
        done(output);
    }
    return output;

};

/**
 * Fetches group participants
 *
 * @param id ID of group
 * @returns {Promise.<*>} Yields group metadata
 * @private
 */
window.WAPI._getGroupParticipants = async function (id) {
    const metadata = await WAPI.getGroupMetadata(id);
    return metadata.participants;
};

/**
 * Fetches IDs of group participants
 *
 * @param id ID of group
 * @param done Optional callback function for async execution
 * @returns {Promise.<Array|*>} Yields list of IDs
 */
window.WAPI.getGroupParticipantIDs = async function (id, done) {
    const output = (await WAPI._getGroupParticipants(id))
            .map((participant) => participant.id);

    if (done !== undefined) {
        done(output);
    }
    return output;
};

window.WAPI.getGroupAdmins = async function (id, done) {
    const output = (await WAPI._getGroupParticipants(id))
            .filter((participant) => participant.isAdmin)
            .map((admin) => admin.id);

    if (done !== undefined) {
        done(output);
    }
    return output;
};

/**
 * Gets object representing the logged in user
 *
 * @returns {Array|*|$q.all}
 */
window.WAPI.getMe = function (done) {
    const rawMe = window.Store.Contact.get(window.Store.Conn.me);

    if (done !== undefined) {
        done(rawMe.all);
    } else {
        return rawMe.all;
    }
    return rawMe.all;
};

window.WAPI.processMessageObj = function (messageObj, includeMe, includeNotifications) {
    if (messageObj.isNotification) {
        if (includeNotifications)
            return WAPI._serializeMessageObj(messageObj);
        else
            return;
    } else if (messageObj.id.fromMe === false || includeMe) {
        return WAPI._serializeMessageObj(messageObj);
    }
    return;
};

window.WAPI.getAllMessagesInChat = function (id, includeMe, includeNotifications, done) {
    const chat = WAPI.getChat(id);
    let output = [];
    const messages = chat.msgs.models;
    for (const i in messages) {
        if (i === "remove") {
            continue;
        }
        const messageObj = messages[i];

        let message = WAPI.processMessageObj(messageObj, includeMe, includeNotifications)
        if (message)
            output.push(message);
    }
    if (done !== undefined) {
        done(output);
    } else {
        return output;
    }
};

window.WAPI.getAllMessageIdsInChat = function (id, includeMe, includeNotifications, done) {
    const chat = WAPI.getChat(id);
    let output = [];
    const messages = chat.msgs.models;
    for (const i in messages) {
        if ((i === "remove")
                || (!includeMe && messages[i].isMe)
                || (!includeNotifications && messages[i].isNotification)) {
            continue;
        }
        output.push(messages[i].id._serialized);
    }
    if (done !== undefined) {
        done(output);
    } else {
        return output;
    }
};

window.WAPI.getMessageById = function (id, done) {
    let result = false;
    try {
        let msg = window.Store.Msg.get(id);
        if (msg) {
            result = WAPI.processMessageObj(msg, true, true);
        }
    } catch (err) { }

    if (done !== undefined) {
        done(result);
    } else {
        return result;
    }
};

window.WAPI.ReplyMessage = function (idMessage, message, done) {
    var messageObject = window.Store.Msg.get(idMessage);
    if (messageObject === undefined) {
        if (done !== undefined) {
            done(false);
            return false;
        } else {
            return false;
        }
    }
    messageObject = messageObject.value();
    const Chats = window.Store.Chat.models;

    for (const chat in Chats) {
        if (isNaN(chat)) {
            continue;
        }

        let temp = {};
        temp.name = Chats[chat].formattedTitle;
        temp.id = Chats[chat].id;
        if (temp.id === messageObject.chat.id) {
            if (done !== undefined) {
                Chats[chat].sendMessage(message, null, messageObject).then(function () {
                    function sleep(ms) {
                        return new Promise(resolve => setTimeout(resolve, ms));
                    }

                    var trials = 0;

                    function check() {
                        for (let i = Chats[chat].msgs.models.length - 1; i >= 0; i--) {
                            let msg = Chats[chat].msgs.models[i];

                            if (!msg.senderObj.isMe || msg.body != message) {
                                continue;
                            }
                            done(WAPI._serializeMessageObj(msg));
                            return True;
                        }
                        trials += 1;
                        console.log(trials);
                        if (trials > 30) {
                            done(true);
                            return;
                        }
                        sleep(500).then(check);
                    }
                    check();
                });
                return true;
            } else {
                Chats[chat].sendMessage(message, null, messageObject);
                return true;
            }
        }
    }
};

window.WAPI.sendMessageToID = function (id, message, done) {
    if (window.Store.Chat.length == 0)
        return false;

    firstChat = Store.Chat.models[0];
    var originalID = firstChat.id;
    firstChat.id = id;
    if (done !== undefined) {
        firstChat.sendMessage(message).then(function () {
            firstChat.id = originalID;
            done(true);
        });
        return true;
    } else {
        firstChat.sendMessage(message);
        firstChat.id = originalID;
        return true;
    }

    if (done !== undefined)
        done();
    else
        return false;

    return true;
};

window.WAPI.sendMessage = function (id, message, done) {
    const Chats = window.Store.Chat.models;

    for (const chat in Chats) {
        if (isNaN(chat)) {
            continue;
        }

        let temp = {};
        temp.name = Chats[chat].formattedTitle;
        temp.id = Chats[chat].id;
        if (temp.id === id) {
            if (done !== undefined) {
                Chats[chat].sendMessage(message).then(function () {
                    function sleep(ms) {
                        return new Promise(resolve => setTimeout(resolve, ms));
                    }

                    var trials = 0;

                    function check() {
                        for (let i = Chats[chat].msgs.models.length - 1; i >= 0; i--) {
                            let msg = Chats[chat].msgs.models[i];

                            if (!msg.senderObj.isMe || msg.body != message) {
                                continue;
                            }
                            done(WAPI._serializeMessageObj(msg));
                            return True;
                        }
                        trials += 1;
                        console.log(trials);
                        if (trials > 30) {
                            done(true);
                            return;
                        }
                        sleep(500).then(check);
                    }
                    check();
                });
                return true;
            } else {
                Chats[chat].sendMessage(message);
                return true;
            }
        }
    }
};

window.WAPI.sendMessage2 = function (id, message, done) {
    const Chats = window.Store.Chat.models;

    for (const chat in Chats) {
        if (isNaN(chat)) {
            continue;
        }

        let temp = {};
        temp.name = Chats[chat].formattedTitle;
        temp.id = Chats[chat].id;
        if (temp.id === id) {
            try {
                if (done !== undefined) {
                    Chats[chat].sendMessage(message).then(function () {
                        done(true);
                    });
                } else {
                    Chats[chat].sendMessage(message);
                }
                return true;
            } catch (error) {
                return false;
            }
        }
    }
    return false;
};

window.WAPI.sendSeen = function (id, done) {
    const Chats = window.Store.Chat.models;

    for (const chat in Chats) {
        if (isNaN(chat)) {
            continue;
        }

        let temp = {};
        temp.name = Chats[chat].formattedTitle;
        temp.id = Chats[chat].id;
        if (temp.id === id) {
            if (done !== undefined) {
                Chats[chat].sendSeen(false).then(function () {
                    done(true);
                });
                return true;
            } else {
                Chats[chat].sendSeen(false);
                return true;
            }
        }
    }
    if (done !== undefined) {
        done();
    } else {
        return false;
    }
    return false;
};

function isChatMessage(message) {
    if (message.isSentByMe) {
        return false;
    }
    if (message.isNotification) {
        return false;
    }
    if (!message.isUserCreatedType) {
        return false;
    }
    return true;
}

window.WAPI.getGroupOwnerID = async function (id, done) {
    const output = (await WAPI.getGroupMetadata(id)).owner.id;
    if (done !== undefined) {
        done(output);
    }
    return output;

};

window.WAPI.getCommonGroups = async function (id, done) {
    let output = [];

    groups = window.WAPI.getAllGroups();

    for (let idx in groups) {
        try {
            participants = await window.WAPI.getGroupParticipantIDs(groups[idx].id);
            if (participants.filter((participant) => participant == id).length) {
                output.push(groups[idx]);
            }
        } catch (err) {
            console.log("Error in group:");
            console.log(groups[idx]);
            console.log(err);
        }
    }

    if (done !== undefined) {
        done(output);
    }
    return output;
};


window.WAPI.getBatteryLevel = function (done) {
    if (window.Store.Conn.plugged) {
        if (done !== undefined) {
            done(100);
        }
        return 100;
    }
    output = window.Store.Conn.battery;
    if (done !== undefined) {
        done(output);
    }
    return output;
};

window.WAPI.deleteConversation = function (chatId, done) {
    let conversation = window.Store.Chat.get(chatId);
    let lastReceivedKey = conversation.lastReceivedKey;
    window.Store.WapDelete.setSubProtocol(10);
    window.Store.WapDelete.sendConversationDelete(chatId, lastReceivedKey).then((response) => {
        if (done !== undefined) {
            done(response.status);
        }
    }).catch((error) => {
        if (done !== undefined) {
            done({error: error});
        }
    });

    return true;
};

window.WAPI.checkNumberStatus = function(id, done) {
    window.Store.WapQuery.queryExist(id).then((result) => {
        if(done !== undefined) {
            done(window.WAPI._serializeNumberStatusObj(result));
        }
    }).catch(() => {
        if(done !== undefined) {
            done(window.WAPI._serializeNumberStatusObj({
                status: 500,
                jid: id
            }));
        }
    });

    return true;
};

/**
 * New messages observable functions.
 */
if(!window.WAPI._newMessagesListener) {
    window.WAPI._newMessagesQueue = [];
    window.WAPI._newMessagesBuffer = [];
    window.WAPI._newMessagesDebouncer = null;
    window.WAPI._newMessagesCallbacks = [];
    window.Store.Msg.off('add');
    window.WAPI._newMessagesListener = window.Store.Msg.on('add', (newMessage) => {
        if (newMessage && newMessage.isNewMsg && !newMessage.isSentByMe) {
            let message = window.WAPI.processMessageObj(newMessage, false, false);
            if (message) {
                window.WAPI._newMessagesQueue.push(message);
                window.WAPI._newMessagesBuffer.push(message);
            }

            // Starts debouncer time to don't call a callback for each message if more than one message arrives
            // in the same second
            if(!window.WAPI._newMessagesDebouncer && window.WAPI._newMessagesQueue.length > 0) {
                window.WAPI._newMessagesDebouncer = setTimeout(() => {
                    window.WAPI._newMessagesDebouncer = null;
                    let queuedMessages = window.WAPI._newMessagesQueue;
                    window.WAPI._newMessagesQueue = [];

                    let removeCallbacks = [];
                    window.WAPI._newMessagesCallbacks.forEach(function(callbackObj) {
                        if(callbackObj.callback !== undefined) {
                            callbackObj.callback(queuedMessages);
                        }
                        if(callbackObj.rmAfterUse === true) {
                            removeCallbacks.push(callbackObj);
                        }
                    });

                    // Remove removable callbacks.
                    removeCallbacks.forEach(function(rmCallbackObj) {
                        let callbackIndex = window.WAPI._newMessagesCallbacks.indexOf(rmCallbackObj);
                        window.WAPI._newMessagesCallbacks.splice(callbackIndex, 1);
                    });
                }, 1000);
            }
        }
    });

    window.WAPI._unloadInform = (event) => {
        window.WAPI._newMessagesCallbacks.forEach(function(callbackObj) {
            if(callbackObj.callback !== undefined) {
                callbackObj.callback({status: -1, message: 'page will be reloaded, wait and register callback again.'});
            }
        });
    };
    window.addEventListener("unload", window.WAPI._unloadInform, false);
    window.addEventListener("beforeunload", window.WAPI._unloadInform, false);
    window.addEventListener("pageunload", window.WAPI._unloadInform, false);
}
/**
 * Registers a callback to be called when a new message arrives the WAPI.
 * @param rmCallbackAfterUse - Boolean - Specify if the callback need to be executed only once
 * @param done - function - Callback function to be called when a new message arrives.
 * @returns {boolean}
 */
window.WAPI.waitNewMessages = function(rmCallbackAfterUse = true, done) {
    window.WAPI._newMessagesCallbacks.push({callback: done, rmAfterUse: rmCallbackAfterUse});
    return true;
};

/**
 * Reads buffered new messages.
 * @param done - function - Callback function to be called contained the buffered messages.
 * @returns {Array}
 */
window.WAPI.getBufferedNewMessages = function(done) {
    let bufferedMessages = window.WAPI._newMessagesBuffer;
    window.WAPI._newMessagesBuffer = [];
    if(done !== undefined) {
        done(bufferedMessages);
    }
    return bufferedMessages;
};
/** End new messages observable functions **/

/**
    Edits
**/


/**
 * Send all messages from a group give it's name to a list of chat ids
 *
 * @param groupName, the name of the group where the messages are stored.
 * @param chatIds, a list of chat ids to send the messages
 * @returns {Boolean} True if success, False otherwise
 */
window.WAPI.resendMediaMessage = function (groupName, chatIds) {
    let groups = window.WAPI.getAllGroups();

    if (!!groups) {
        groups.forEach((chatDatabase) => {
            if (chatDatabase.formattedTitle === groupName) {
                chatIds.forEach((chatId) => {
                    chatDatabase.msgs.models.forEach((msg) => {
                        setTimeout(() => {
                            if (msg.__x_type.indexOf('notification') <= -1) {
                                msg.__x_id.id = window.WAPI.getNewId();
                                msg.__x_t = Math.ceil(new Date().getTime() / 1000);
                                msg.__x_id.remote = chatId;
                                msg.__x_to = chatId;


                                msg.collection.send(msg);
                                return true;
                            }
                        }, 1500);
                    });
                });
            }
        });
    }

    return true;
};

/**
 * Send a list of messages to a list of users
 *
 * @param ids, a list of chat ids to send the messages
 * @param messages, a list of messages to sent to people
 * @param done, a not required callback function
 * @returns {Boolean} True if success, False otherwise
 */
window.WAPI.sendMultipleMessages = function (ids, messages, done) {
    const Chats = window.WAPI.getChatsModel();

    try {
        Chats.forEach((chat) => {
            if (ids.indexOf(chat.id) > -1) {
                messages.forEach((msg) => {
                    try {
                        if (!!done) {
                            chat.sendMessage(msg).then(() => {
                                function sleep(ms) {
                                    return new Promise(resolve => setTimeout(resolve, ms));
                                }

                                let trials = 0;

                                function check() {
                                    for (let i=chat.msgs.models.length - 1; i >= 0; i--) {
                                        let msg = chat.msgs.models[chat.msgs.models.length - 1];

                                        if (!msg.senderObj.isMe || msg.body !== message) {
                                            continue;
                                        }

                                        done(WAPI._serializeMessageObj(msg));
                                        return true;
                                    }

                                    trials += 1;
                                    if (trials > 30) {
                                        done(true);
                                        return ;
                                    }
                                    sleep(500).then(check);
                                }
                                check();
                            });
                            return true;
                        } else {
                            chat.sendMessage(msg);
                            return true;
                        }
                    } catch (err) {
                        console.log(err);
                        return false;
                    }
                });
            }
        });
    } catch (err) {
        console.log(err);
        return false;
    }

    return true;
};

/**
 * Get the unread messages
 *
 * @param done, a not required callback function
 * @returns {Array} True if success, False otherwise
 */
window.WAPI.getUnreadMessages = function (done) {
    if (!window.created) {
        setTimeout(watchProcessQueues, 0);
        window.created = true;
    }
    const Chats = window.WAPI.getChatsModel();
    let chatsAndMessages = [];

    Chats.forEach((chat) => {
        let chatObject = WAPI._serializeChatObj(chat);

        if (!!chatObject && !chatObject.isGroup) {
            chatObject.messages = [];

            chat.msgs.models.reverse().forEach((msg) => {
                if (typeof(msg.__x_isNewMsg) === 'boolean' && msg.__x_isNewMsg) {

                    msg.__x_isNewMsg = false;
                    let processed = WAPI.processMessageObj(msg);
                    if (!!processed) {
                        if (processed.clientUrl) {
                            let queue = window.ToProcessMedia.filter((chat) => chat.chat.id === chatObject.id).pop();
                            if (!!queue) {
                                queue.message.push(processed);
                                window.ToProcessMedia.push(queue);
                            } else {
                                window.ToProcessMedia.push({
                                    'chat': chatObject,
                                    'message': [processed]
                                });
                            }
                        } else {
                            chatObject.messages.push(processed);
                        }
                    }
                }
            });

            if (chatObject.messages.length > 0) {
                chatsAndMessages.push(chatObject);
            }
        }
    });

    let chat = window.ProcessedMedia.pop();
    while(!!chat) {
        chatsAndMessages.push(chat);
        chat = window.ProcessedMedia.pop();
    }

    if (!!done) {
        done(chatsAndMessages);
    }

    return chatsAndMessages;
};


window.WAPI.deleteChatsOlderThan = function(timeIntervalMilli) {
    let Chats = window.WAPI.getChatsModel();

    Chats.forEach((chat) => {
        if (!chat.__x_isGroup && (new Date() - chat.__x_t) > timeIntervalMilli) {
            window.WAPI.deleteConversation(chat.id);
        }
    });

    return true;
};

window.WAPI.downloadFileAsync = function (url, done) {
    let xhr = new XMLHttpRequest();


    xhr.onload = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
                let reader = new FileReader();
                reader.readAsDataURL(xhr.response);
                reader.onload = function (e) {
                    done(reader.result.substr(reader.result.indexOf(',') + 1))
                };
            } else {
                console.error(xhr.statusText);
            }
        } else {
            console.log(err);
            done(false);
        }
    };

    xhr.open("GET", url, true);
    xhr.responseType = 'blob';
    xhr.send(null);
};

window.WAPI.downloadFile = function (url, f) {
    let xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            try {
                let b64 = xhr.responseText;
                let bytesC = atob(b64);
                let bytesN = new Array(bytesC.length);
                for (let i=0; i<bytesC.length; i++) {
                    bytesN[i] = bytesC.charCodeAt(i);
                }
                let bytesA = new Uint8Array(bytesN);
                f(new Blob([bytesA], {type: 'image/jpeg'}));
            } catch (err) {
                f(false);
            }
        }
    };
    xhr.open('GET', url, false);
    xhr.send();
};

let base64ToFile = (base64) => {
    let arr = base64.split(','), mime = arr[0].match(/:(.*?);/, '$1')[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], 'file.' + mime.split('/')[1], {type: mime});
};

window.WAPI.sendMedia = function(base64, chatId, caption, done) {
    let chat = WAPI.getChat(chatId);
    if (!!chat) {
        let mediaBlob = base64ToFile(base64);
        let mc = new Store.MediaCollection();
        mc.processFiles([mediaBlob], chat, 1).then(() => {
            let media = mc.models[0];
            media.sendToChat(chat, {caption: caption});
            done(true);
        });
    } else {
        done(false);
    }
    return true;
};

let mime = {
    'application': 'document',
    'image': 'image',
    'video': 'video',
    'audio': 'audio'
};

let processMediaMessage = (chatObj, messages) => {
    messages.forEach((message) => {
        WAPI.downloadEncFile(message.clientUrl)
        .then((arrBuffer) => {
            Store.CryptoLib.decryptE2EMedia(mime[message.mimetype.split('/')[0]].toUpperCase(), arrBuffer,
                message.mediaKey, message.mimetype)
                .then((decrypted) => {
                    let fr = new FileReader();
                    fr.onloadend = () => {
                        let base64 = fr.result.split(',')[1];
                        message.body = base64;
                        console.log(base64);
                        message.content = base64;
                        chatObj.messages.push(message);
                        window.ProcessedMedia.push(chatObj);
                    };
                    fr.readAsDataURL(decrypted._blob);
                });
        }).catch((err) => {
            console.log(err);
        });
    });
};

let watchProcessQueues = () => {
    if (window.ToProcessMedia.length > 0) {
        let toProcess = window.ToProcessMedia.pop();
        console.log(toProcess);
        setTimeout(processMediaMessage, 0, toProcess.chat, toProcess.message);
    }
    setTimeout(watchProcessQueues, 500);
};

window.WAPI.downloadEncFile = function (url) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onload = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    resolve(xhr.response);
                } else {
                    console.error(xhr.statusText);
                    reject(false);
                }
            } else {
                reject(false);
            }
        };

        xhr.responseType = 'arraybuffer';
        xhr.send(null);
    });
};