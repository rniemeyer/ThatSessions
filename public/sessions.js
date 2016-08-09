/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/knockout/knockout.d.ts"/>
/// <reference path="../typings/jquery/jquery.d.ts"/>
/// <reference path="../typings/dropboxjs/dropboxjs.d.ts"/>
/// <reference path="../typings/amplifyjs/amplifyjs.d.ts"/>
/// <reference path="../typings/bootstrap/bootstrap.d.ts"/>
/// <reference path="../typings/sugarjs/sugar.d.ts"/>
/// <reference path="../typings/firebase/firebase.d.ts"/>
var ThatSessionsViewModel = (function () {
    function ThatSessionsViewModel() {
        var _this = this;
        this.sessionsByDay = ko.observableArray([]);
        this.showOld = ko.observable(false);
        this.loadingSessions = ko.observable(false);
        this.search = ko.observable("");
        this.delayedSearch = ko.computed(this.search).extend({ throttle: 250 });
        this.onlyFavorites = ko.observable(amplify.store("onlyFavorites") || false);
        this.showMap = ko.observable(false);
        this.showAbout = ko.observable(false);
        this.dropboxClient = ko.observable(new Dropbox.Client({ key: "9keh9sopjf08vhi" }));
        this.dropboxAuthenticated = ko.observable(false);
        this.savingToDropbox = ko.observable(false);
        this.firebaseModel = {};
        //Computeds
        this.days = ko.computed(function () {
            var days = ko.utils.arrayFilter(_this.sessionsByDay(), function (day) { return _this.showOld() || day.Day >= Date.create("today"); });
            if (days.length) {
                days[0].selected(true);
            }
            return days;
        });
        this.sessions = ko.computed(function () {
            var flatDays = _.flatten(_this.sessionsByDay(), "TimeSlots");
            var flatSessions = _.flatten(flatDays, "Sessions");
            return flatSessions;
        });
        this.favoriteSessionIDs = ko.computed(function () {
            var favSessions = ko.utils.arrayFilter(_this.sessions(), function (session) { return session.isFavorite(); });
            var favSessionIDs = ko.utils.arrayMap(favSessions, function (session) { return session.Id; });
            return favSessionIDs;
        });
        this.selectedDay = ko.computed(function () { return ko.utils.arrayFirst(_this.sessionsByDay(), function (day) { return day.selected(); }); });
        this.selectedSessions = ko.computed(function () {
            var selectedDay = _this.selectedDay();
            var search = _this.delayedSearch().toLowerCase();
            var selectedSessions = ko.utils.arrayFilter(_this.sessions(), function (session) {
                var searchResult = true;
                if (search) {
                    searchResult = false;
                    var tagString = session.Tags.map(function (tag) { return tag.Name; }).join(" ");
                    searchResult = (session.Title.toLowerCase().indexOf(search) > -1) || (session.Description.toLowerCase().indexOf(search) > -1) || (tagString.toLowerCase().indexOf(search) > -1);
                    searchResult = searchResult || !!ko.utils.arrayFirst(session.Speakers, function (person) {
                        return (person.FirstName.toLowerCase().indexOf(search) > -1) || (person.LastName.toLowerCase().indexOf(search) > -1);
                    });
                }
                var dateResult = selectedDay && session.ScheduledDateTime.clone().beginningOfDay().valueOf() === selectedDay.Day.valueOf();
                var timeResult = _this.showOld() || session.ScheduledDateTime.clone().addHours(1).isFuture();
                var favoritesResult = !_this.onlyFavorites() || session.isFavorite();
                return (session.Accepted && dateResult && searchResult && favoritesResult && timeResult);
            });
            return selectedSessions.sortBy(function (session) { return session.ScheduledDateTime.valueOf() + session.PrimaryCategory + parseInt(session.Level, 10); });
        });
        this.dropboxClient().authenticate({ interactive: false }, function (err, client) {
            _this.dropboxAuthenticated(client.isAuthenticated());
        });
        this.onlyFavorites.subscribe(function (newValue) { return amplify.store("onlyFavorites", newValue); });
    }
    ThatSessionsViewModel.prototype.connectDropbox = function () {
        var _this = this;
        this.dropboxClient().authenticate(function (err, client) {
            _this.dropboxAuthenticated(client.isAuthenticated());
        });
    };
    ThatSessionsViewModel.prototype.disconnectDropbox = function () {
        var _this = this;
        this.dropboxClient().signOut(function (err) {
            _this.dropboxAuthenticated(false);
        });
    };
    //Returns a function that toggles the provided observable
    ThatSessionsViewModel.prototype.toggle = function (observable) {
        return function () { return observable(!observable()); };
    };
    ThatSessionsViewModel.prototype.selectDay = function ($root) {
        return function (clickedDay) {
            if (!clickedDay.selected()) {
                clickedDay.selected(true);
                ko.utils.arrayForEach($root.sessionsByDay(), function (day) {
                    if (day.Day.valueOf() !== clickedDay.Day.valueOf()) {
                        day.selected(false);
                    }
                });
            }
        };
    };
    ThatSessionsViewModel.prototype.doNothing = function () {
        //Bwahahahahaha
    };
    return ThatSessionsViewModel;
}());
$(function () {
    $(".about a").attr("target", "_blank");
    _.extend(ko.bindingHandlers, {
        collapse: {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                $(element).attr({ "data-toggle": "collapse", "data-target": valueAccessor() });
                setTimeout(function () { $(element).collapse({ toggle: false }); }, 0);
            }
        }
    });
    var myFirebaseRef = new Firebase("https://sizzling-heat-7534.firebaseio.com");
    var viewModel = new ThatSessionsViewModel();
    ko.applyBindings(viewModel);
    function indexObject(obj, index) {
        if (obj && obj["$id"]) {
            index[obj["$id"]] = obj;
            var keys = Object.keys(obj);
            for (var keyIdx = 0; keyIdx < keys.length; keyIdx++) {
                var prop = obj[keys[keyIdx]];
                if (_.isArray(prop)) {
                    for (var propIdx = 0; propIdx < prop.length; propIdx++) {
                        indexObject(prop[propIdx], index);
                    }
                }
                else {
                    indexObject(prop, index);
                }
            }
        }
    }
    function hydrateObjectFromIndex(obj, index) {
        if (obj && _.isObject(obj)) {
            var keys = Object.keys(obj);
            for (var keyIdx = 0; keyIdx < keys.length; keyIdx++) {
                var prop = obj[keys[keyIdx]];
                if (prop) {
                    if (_.isArray(prop)) {
                        for (var propIdx = 0; propIdx < prop.length; propIdx++) {
                            var propElmt = prop[propIdx];
                            if (propElmt["$ref"]) {
                                prop[propIdx] = index[propElmt["$ref"]];
                            }
                            hydrateObjectFromIndex(prop[propIdx], index);
                        }
                    }
                    else {
                        if (prop["$ref"]) {
                            obj[keys[keyIdx]] = index[prop["$ref"]];
                        }
                        hydrateObjectFromIndex(obj[keys[keyIdx]], index);
                    }
                }
            }
        }
    }
    amplify.request.define("sessions", "ajax", { url: "/getSessions", type: "POST" });
    viewModel.loadingSessions(true);
    amplify.request("sessions", function (data) {
        viewModel.loadingSessions(false);
        var index = {};
        indexObject(data, index);
        hydrateObjectFromIndex(data, index);
        for (var i = 0; i < data.ScheduledSessions.length; i++) {
            var sessionsByDay = data.ScheduledSessions[i];
            sessionsByDay.selected = ko.observable(false);
            var dateString = sessionsByDay.Day.split(" ")[1];
            sessionsByDay.Day = Date.create(dateString);
            for (var j = 0; j < sessionsByDay.TimeSlots.length; j++) {
                var sessionsByTimeslot = sessionsByDay.TimeSlots[j];
                for (var k = 0; k < sessionsByTimeslot.Sessions.length; k++) {
                    var session = sessionsByTimeslot.Sessions[k];
                    var dateTimeString = dateString + " " + sessionsByTimeslot.Time;
                    session.ScheduledDateTime = Date.create(dateTimeString);
                    session.isFavorite = ko.observable(false);
                    session.favoriteCount = ko.observable(0);
                    session.IsOpenSpaces = session.PrimaryCategory.indexOf("Open Spaces") > -1 ||
                        (session.SecondaryCategory && session.SecondaryCategory.indexOf("Open Spaces") > -1);
                    session.IsFamilyApproved = session.IsFamilyApproved ||
                        session.PrimaryCategory.indexOf("Family") > -1 ||
                        (session.SecondaryCategory && session.SecondaryCategory.indexOf("Family") > -1);
                }
                ;
            }
            ;
        }
        ;
        viewModel.sessionsByDay(data.ScheduledSessions);
        var futureSessions = ko.utils.arrayFilter(viewModel.sessions(), function (session) { return session.ScheduledDateTime.clone().addHours(1).isFuture(); });
        if (!futureSessions.length) {
            viewModel.showOld(true);
        }
        var gotFavorites = false, gotFirebase = false;
        getFavorites(function (favoriteSessionIDs) {
            gotFavorites = true;
            viewModel.sessions().each(function (session) {
                session.isFavorite(favoriteSessionIDs.indexOf(session.Id) > -1);
                session.isFavorite.subscribe(function (newValue) {
                    session.favoriteCount(session.favoriteCount() + (newValue ? 1 : -1));
                });
            });
            viewModel.favoriteSessionIDs.subscribe(function (newValue) {
                saveFavorites(newValue);
            });
            if (gotFavorites && gotFirebase) {
                mergePreExistingFavorites();
            }
        });
        //TODO: Handle if no data comes back from Firebase
        myFirebaseRef.once("value", function (snapshot) {
            viewModel.firebaseModel = snapshot.val() || { favoriteCounts: {}, idsLoaded: {} };
            gotFirebase = true;
            if (gotFavorites && gotFirebase) {
                mergePreExistingFavorites();
            }
            viewModel.sessions().each(function (session) {
                session.favoriteCount(viewModel.firebaseModel.favoriteCounts[session.Id] || 0);
                //ensure updates to favorites get sent to firebase
                session.favoriteCount.subscribe(function (newValue) {
                    viewModel.firebaseModel.favoriteCounts = viewModel.firebaseModel.favoriteCounts || {};
                    viewModel.firebaseModel.favoriteCounts[session.Id] = newValue;
                    myFirebaseRef.set(viewModel.firebaseModel);
                });
            });
            // Then set up Firebase.on handler
            myFirebaseRef.on("value", function (snapshot) {
                viewModel.firebaseModel = snapshot.val() || { favoriteCounts: {}, idsLoaded: {} };
                viewModel.sessions().each(function (session) {
                    session.favoriteCount(viewModel.firebaseModel.favoriteCounts[session.Id] || 0);
                });
            });
        });
    });
    function mergePreExistingFavorites() {
        var userId = viewModel.dropboxClient().dropboxUid() || amplify.store("userId") || generateUUID();
        amplify.store("userId", userId);
        if (!viewModel.firebaseModel.idsLoaded[userId]) {
            viewModel.sessions().each(function (session) {
                if (session.isFavorite()) {
                    viewModel.firebaseModel.favoriteCounts[session.Id] = viewModel.firebaseModel.favoriteCounts[session.Id] || 0;
                    viewModel.firebaseModel.favoriteCounts[session.Id]++;
                }
            });
            viewModel.firebaseModel.idsLoaded[userId] = true;
            myFirebaseRef.set(viewModel.firebaseModel);
        }
    }
    function getFavorites(callback) {
        var local = amplify.store("favorites") || [];
        var client = viewModel.dropboxClient();
        if (client && client.isAuthenticated()) {
            client.readFile("data.json", function (error, fileContents) {
                if (!error) {
                    callback((fileContents && JSON.parse(fileContents)) || []);
                }
                else {
                    callback(local);
                }
            });
        }
        else {
            callback(local);
        }
    }
    function saveFavorites(favorites) {
        amplify.store("favorites", favorites);
        var dropboxClient = viewModel.dropboxClient();
        if (dropboxClient && dropboxClient.isAuthenticated()) {
            viewModel.savingToDropbox(true);
            dropboxClient.writeFile("data.json", JSON.stringify(favorites), function (error, stat) {
                viewModel.savingToDropbox(false);
            });
        }
    }
    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }
    ;
});
//# sourceMappingURL=sessions.js.map