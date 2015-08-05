/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/knockout/knockout.d.ts"/>
/// <reference path="../typings/jquery/jquery.d.ts"/>
/// <reference path="../typings/dropboxjs/dropboxjs.d.ts"/>
/// <reference path="../typings/amplifyjs/amplifyjs.d.ts"/>
/// <reference path="../typings/bootstrap/bootstrap.d.ts"/>
/// <reference path="../typings/sugarjs/sugar.d.ts"/>

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

class ThatSessionsViewModel {
    sessionsByDay: KnockoutObservableArray<ThatDay> = ko.observableArray([]);
    showOld = ko.observable(false);
    search = ko.observable("");
    delayedSearch = ko.computed<string>(this.search).extend({ throttle: 250 });
    onlyFavorites = ko.observable(false);
    showMap = ko.observable(false);
    showAbout = ko.observable(false);
    dropboxClient: KnockoutObservable<Dropbox.Client> = ko.observable(new Dropbox.Client({ key: "9keh9sopjf08vhi" }));
    dropboxAuthenticated = ko.observable(false);
    savingToDropbox = ko.observable(false);

    //Computeds
    days = ko.computed(() => {
        var days = ko.utils.arrayFilter(this.sessionsByDay(), (day) => this.showOld() || day.Day >= Date.create("today"));
        if (days.length) {
            var selectedDateValue = amplify.store("selectedDateValue");
            var selectedDay;
            if (selectedDateValue) {
                selectedDay = ko.utils.arrayFirst(days, (day) => day.Day.valueOf() === selectedDateValue);
            }
            if (selectedDay) {
                selectedDay.selected(true);
            }
            else {
                days[0].selected(true); //Select the first day by default
            }
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
        //var selectedCategories = ko.utils.arrayMap(this.selectedCategories(), function (category) { return category.name; });
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
            //return ((selectedCategories.indexOf(session.Category) > -1) && searchResult);
            return (session.Accepted && dateResult && searchResult && favoritesResult && timeResult);
        });
        return selectedSessions.sortBy((session) => session.ScheduledDateTime.valueOf() + parseInt(session.Level, 10));
    });
    
    constructor() {
        this.dropboxClient().authenticate({ interactive: false }, (err, client : Dropbox.Client) => {
            this.dropboxAuthenticated(client.isAuthenticated());
        });
    }

    connectDropbox() {
        this.dropboxClient().authenticate((err, client : Dropbox.Client) => {
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

    var viewModel = new ThatSessionsViewModel();
    ko.applyBindings(viewModel);
    
    amplify.request.define("sessions", "ajax", { url: "/getSessions", type: "POST" });
    amplify.request("sessions", function(data) {
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
                };
            };
        };

        viewModel.sessionsByDay(data.ScheduledSessions);

        var futureSessions = ko.utils.arrayFilter(viewModel.sessions(), (session) => session.ScheduledDateTime.clone().addHours(1).isFuture());
        if (!futureSessions.length) {
            viewModel.showOld(true);
        }

        getFavorites((favoriteSessionIDs) => {
            viewModel.sessions().each((session) => {
                session.isFavorite(favoriteSessionIDs.indexOf(session.Id) > -1);
            });
            viewModel.favoriteSessionIDs.subscribe((newValue) => {
                saveFavorites(newValue);
            });
        });
    });

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
});