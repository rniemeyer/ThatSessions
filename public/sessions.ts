/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/knockout/knockout.d.ts"/>
/// <reference path="../typings/jquery/jquery.d.ts"/>
/// <reference path="../typings/dropboxjs/dropboxjs.d.ts"/>
/// <reference path="../typings/amplifyjs/amplifyjs.d.ts"/>
/// <reference path="../typings/bootstrap/bootstrap.d.ts"/>
/// <reference path="../typings/sugarjs/sugar.d.ts"/>
/// <reference path="../typings/firebase/firebase.d.ts"/>

interface ThatDay {
    Day: Date;
    TimeSlots: ThatTimeslot[];
    selected: KnockoutObservable<boolean>;
}

interface ThatTimeslot {
    Time: string;
    Sessions: ThatSession[];
}

interface ThatSession {
    isFavorite: KnockoutObservable<boolean>;
    favoriteCount: KnockoutObservable<number>;
    Accepted: boolean;
    Canceled: boolean;
    Category: string;
    Description: string;
    Id: number;
    IsFamilyApproved: boolean;
    IsUserFavorite: boolean;
    LastUpdated: string; //"2014-08-08T11:26:21.693"
    Level: string; //"100"
    ScheduledDateTime: Date;
    ScheduledRoom: string;
    SessionLinks: Array<string>;
    ShowMoreDetails: boolean;
    Speakers: ThatSpeaker[];
    Tags: string[];
    Title: string;
    Updated: boolean;
}

interface ThatSpeaker {
    Biography: string;
    Company: string;
    Facebook: string;
    FirstName: string;
    GitHub: string;
    GooglePlus: string;
    HeadShot: string;
    LastName: string;
    LastUpdated: string;
    LinkedIn: string;
    Title: string;
    Twitter: string;
    UserName: string;
    WebSite: string;
}

interface ThatFirebase {
    idsLoaded?: { [index: string]: boolean };
    favoriteCounts?: { [index: number]: number };
}

class ThatSessionsViewModel {
    sessionsByDay: KnockoutObservableArray<ThatDay> = ko.observableArray([]);
    showOld = ko.observable(false);
    search = ko.observable("");
    delayedSearch = ko.computed<string>(this.search).extend({ throttle: 250 });
    onlyFavorites = ko.observable(amplify.store("onlyFavorites") || false);
    showMap = ko.observable(false);
    showAbout = ko.observable(false);
    dropboxClient: KnockoutObservable<Dropbox.Client> = ko.observable(new Dropbox.Client({ key: "9keh9sopjf08vhi" }));
    dropboxAuthenticated = ko.observable(false);
    savingToDropbox = ko.observable(false);
    firebaseModel: ThatFirebase = {};

    //Computeds
    days = ko.computed(() => {
        var days = ko.utils.arrayFilter(this.sessionsByDay(), (day) => this.showOld() || day.Day >= Date.create("today"));
        if (days.length) {
            days[0].selected(true);
        }
        return days;
    });
    sessions = ko.computed(() => {
        var flatDays = _.flatten<ThatTimeslot>(this.sessionsByDay(), "TimeSlots");
        var flatSessions = _.flatten<ThatSession>(flatDays, "Sessions");
        return flatSessions;
    });
    favoriteSessionIDs = ko.computed(() => {
        var favSessions = ko.utils.arrayFilter(this.sessions(), (session) => session.isFavorite());
        var favSessionIDs = ko.utils.arrayMap(favSessions, (session) => session.Id);
        return favSessionIDs;
    });
    selectedDay = ko.computed(() => ko.utils.arrayFirst(this.sessionsByDay(), (day) => day.selected()));
    selectedSessions = ko.computed(() => {
        var selectedDay = this.selectedDay();
        var search = this.delayedSearch().toLowerCase();
        var selectedSessions = ko.utils.arrayFilter(this.sessions(), (session) => {
            var searchResult = true;
            if (search) {
                searchResult = false;
                searchResult = (session.Title.toLowerCase().indexOf(search) > -1) || (session.Description.toLowerCase().indexOf(search) > -1);
                searchResult = searchResult || !!ko.utils.arrayFirst(session.Speakers, (person) => {
                    return (person.FirstName.toLowerCase().indexOf(search) > -1) || (person.LastName.toLowerCase().indexOf(search) > -1);
                });
            }
            var dateResult = selectedDay && session.ScheduledDateTime.clone().beginningOfDay().valueOf() === selectedDay.Day.valueOf();
            var timeResult = this.showOld() || session.ScheduledDateTime.clone().addHours(1).isFuture();
            var favoritesResult = !this.onlyFavorites() || session.isFavorite();
            return (session.Accepted && dateResult && searchResult && favoritesResult && timeResult);
        });
        return selectedSessions.sortBy((session) => session.ScheduledDateTime.valueOf() + parseInt(session.Level, 10));
    });

    constructor() {
        this.dropboxClient().authenticate({ interactive: false }, (err, client: Dropbox.Client) => {
            this.dropboxAuthenticated(client.isAuthenticated());
        });
        this.onlyFavorites.subscribe((newValue) => amplify.store("onlyFavorites", newValue));
    }

    connectDropbox() {
        this.dropboxClient().authenticate((err, client: Dropbox.Client) => {
            this.dropboxAuthenticated(client.isAuthenticated());
        });
    }

    disconnectDropbox() {
        this.dropboxClient().signOut((err) => {
            this.dropboxAuthenticated(false);
        });
    }

    //Returns a function that toggles the provided observable
    toggle(observable: KnockoutObservable<any>) {
        return () => observable(!observable());
    }

    selectDay($root: ThatSessionsViewModel) {
        return (clickedDay: ThatDay) => {
            if (!clickedDay.selected()) {
                clickedDay.selected(true);
                ko.utils.arrayForEach($root.sessionsByDay(), (day) => {
                    if (day.Day.valueOf() !== clickedDay.Day.valueOf()) {
                        day.selected(false);
                    }
                });
            }
        }
    }

    doNothing() {
        //Bwahahahahaha
    }
}

$(function() {
    $(".about a").attr("target", "_blank");

    _.extend(ko.bindingHandlers, {
        collapse: {
            init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                $(element).attr({ "data-toggle": "collapse", "data-target": valueAccessor() });
                setTimeout(function() { $(element).collapse({ toggle: false }); }, 0);
            }
        }
    });

    var myFirebaseRef = new Firebase("https://sizzling-heat-7534.firebaseio.com");
    var viewModel = new ThatSessionsViewModel();
    ko.applyBindings(viewModel);

    function indexObject(obj, index: {}) {
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

    function hydrateObjectFromIndex(obj, index: {}) {
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
    amplify.request("sessions", function(data) {
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
                };
            };
        };

        viewModel.sessionsByDay(data.ScheduledSessions);

        var futureSessions = ko.utils.arrayFilter(viewModel.sessions(), (session) => session.ScheduledDateTime.clone().addHours(1).isFuture());
        if (!futureSessions.length) {
            viewModel.showOld(true);
        }

        var gotFavorites = false, gotFirebase = false;
        getFavorites((favoriteSessionIDs) => {
            gotFavorites = true;
            viewModel.sessions().each((session) => {
                session.isFavorite(favoriteSessionIDs.indexOf(session.Id) > -1);
                session.isFavorite.subscribe((newValue) => {
                    session.favoriteCount(session.favoriteCount() + (newValue ? 1 : -1));
                });
            });
            viewModel.favoriteSessionIDs.subscribe((newValue) => {
                saveFavorites(newValue);
            });

            if (gotFavorites && gotFirebase) {
                mergePreExistingFavorites();
            }
        });
        
        //TODO: Handle if no data comes back from Firebase
        myFirebaseRef.once("value", (snapshot) => {
            viewModel.firebaseModel = snapshot.val() || { favoriteCounts: {}, idsLoaded: {} };
            gotFirebase = true;
            if (gotFavorites && gotFirebase) {
                mergePreExistingFavorites();
            }
            viewModel.sessions().each((session) => {
                session.favoriteCount(viewModel.firebaseModel.favoriteCounts[session.Id] || 0); 
                //ensure updates to favorites get sent to firebase
                session.favoriteCount.subscribe((newValue) => {
                    viewModel.firebaseModel.favoriteCounts = viewModel.firebaseModel.favoriteCounts || {};
                    viewModel.firebaseModel.favoriteCounts[session.Id] = newValue;
                    myFirebaseRef.set(viewModel.firebaseModel);
                })
            });
            // Then set up Firebase.on handler
            myFirebaseRef.on("value", (snapshot) => {
                viewModel.firebaseModel = snapshot.val() || { favoriteCounts: {}, idsLoaded: {} };
                viewModel.sessions().each((session) => {
                    session.favoriteCount(viewModel.firebaseModel.favoriteCounts[session.Id] || 0);
                });
            });
        });
    });

    function mergePreExistingFavorites() {
        var userId: string = viewModel.dropboxClient().dropboxUid() || amplify.store("userId") || generateUUID();
        amplify.store("userId", userId);
        if (!viewModel.firebaseModel.idsLoaded[userId]) {
            viewModel.sessions().each((session) => {
                if (session.isFavorite()) {
                    viewModel.firebaseModel.favoriteCounts[session.Id] = viewModel.firebaseModel.favoriteCounts[session.Id] || 0;
                    viewModel.firebaseModel.favoriteCounts[session.Id]++;
                }
            });
            viewModel.firebaseModel.idsLoaded[userId] = true;
            myFirebaseRef.set(viewModel.firebaseModel);
        }
    }

    function getFavorites(callback: (favoriteSessionIDs: number[]) => void) {
        var local: number[] = amplify.store("favorites") || [];
        var client = viewModel.dropboxClient();
        if (client && client.isAuthenticated()) {
            client.readFile("data.json", (error: Dropbox.ApiError, fileContents: string) => {
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

    function saveFavorites(favorites: number[]): void {
        amplify.store("favorites", favorites);
        var dropboxClient = viewModel.dropboxClient();
        if (dropboxClient && dropboxClient.isAuthenticated()) {
            viewModel.savingToDropbox(true);
            dropboxClient.writeFile("data.json", JSON.stringify(favorites), (error, stat) => {
                viewModel.savingToDropbox(false);
            });
        }
    }

    function generateUUID(): string {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    };
});