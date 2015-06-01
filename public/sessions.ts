/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/knockout/knockout.d.ts"/>
/// <reference path="../typings/jquery/jquery.d.ts"/>
/// <reference path="../typings/dropboxjs/dropboxjs.d.ts"/>
/// <reference path="../typings/amplifyjs/amplifyjs.d.ts"/>
/// <reference path="../typings/bootstrap/bootstrap.d.ts"/>
/// <reference path="../typings/sugarjs/sugar.d.ts"/>

//TODO: listview, offline, IE bummer, favorites, amplify caching, gravatar, google analytics

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

interface DropboxModel {
    favoriteSessionIDs: number[];
    instantOfUpdate: number;
}

/**
 * ThatSessionsViewModel
 */
class ThatSessionsViewModel {
    sessionsByDay: KnockoutObservableArray<ThatDay> = ko.observableArray([]);
    showOld = ko.observable(false);
    search = ko.observable("");
    delayedSearch = ko.computed<string>(this.search).extend({ throttle: 250 });
    onlyFavorites = ko.observable(false);
    showMap = ko.observable(false);
    showAbout = ko.observable(false);
    dropboxClient: KnockoutObservable<Dropbox.Client> = ko.observable(null);
    savingToDropbox = ko.observable(false);
    instantOfUpdate: number;

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

    connectDropbox() {
        if (this.dropboxClient()) {
            this.dropboxClient().authenticate();
        }
    }

    disconnectDropbox() {
        if (this.dropboxClient()) {
            this.dropboxClient().signOut((err) => {
                if (!err) {
                    this.dropboxClient(null);
                }
            })
        }
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

    var dropboxClient = new Dropbox.Client({ key: "9keh9sopjf08vhi" });

    var viewModel = new ThatSessionsViewModel();

    //viewModel.categories = ko.computed(function viewModel$categories()
    //{
    //    var categories = [];
    //    ko.utils.arrayForEach(this.sessions(), function (session)
    //    {
    //        var category = ko.utils.arrayFirst(categories, function (cat) { return cat.name === session.Category });
    //        if (!category)
    //        {
    //            categories.push({ name: session.Category, count: 1, selected: ko.observable(true) });
    //        }
    //        else
    //        {
    //            category.count++;
    //        }
    //    });
    //    return categories;
    //}, viewModel);

    //viewModel.selectedCategories = ko.computed(function viewModel$selectedCategories()
    //{
    //    return ko.utils.arrayFilter(this.categories(), function (category)
    //    {
    //        return category.selected();
    //    });
    //}, viewModel);

    //viewModel.allCategoriesSelected = ko.computed(function ()
    //{
    //    return !ko.utils.arrayFirst(this.categories(), function (category) { return !category.selected(); });
    //}, viewModel);

    ko.applyBindings(viewModel);

    amplify.request.define("sessions", "ajax", { url: "/getSessions", type: "POST" });

    amplify.request("sessions", function(data) {
        //data.ScheduledSessions[]
        // Day = "Sat 8/9"
        // TimeSlots[]
        // Time = "8:30 AM"
        // Sessions[]
        // Accepted: true
        // Canceled: false
        // Category: "That Conference"
        // Description: "On August 9th and 10th, That Conference will host the 2014 Midwest GiveCamp. This year, Midwest Midwest GiveCamp and That Conference will team up with the Humanitarian Toolbox in a quest to help build software in support of disaster relief. This is a free event for all paid attendees and food will be provided."
        // Id: 5468
        // IsFamilyApproved: false
        // IsUserFavorite: null
        // LastUpdated: "2014-08-08T11:26:21.693"
        // Level: "100"
        // ScheduledDateTime: Sat Aug 09 2014 08:30:00 GMT-0500 (Central Daylight Time)
        // ScheduledRoom: "Cypress"
        // SessionLinks: Array[0]
        // ShowMoreDetails: false
        // Speakers: Array[1]
        // 0: Object
        // Biography: "The best developer conference!"
        // Company: null
        // Facebook: null
        // FirstName: "That"
        // GitHub: null
        // GooglePlus: null
        // HeadShot: "/cloud/profilephotos/That-Conference-b09e7430-5905-418e-b775-fb08f8e814c8-635349489932052255.png"
        // LastName: "Conference"
        // LastUpdated: "2014-05-14T14:24:22.567"
        // LinkedIn: null
        // Title: null
        // Twitter: "@ThatConference"
        // UserName: "TCAdmin"
        // WebSite: "http://www.thatconference.com"
        // __proto__: Object
        // length: 1
        // __proto__: Array[0]
        // Tags: Array[2]
        // Title: "GiveCamp and The Humanitarian Toolbox"
        // Updated: true

        var favoriteSessionIDs = amplify.store("favoriteSessionIDs");
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
                    session.isFavorite = ko.observable(favoriteSessionIDs && (favoriteSessionIDs.indexOf(session.Id) > -1));
                };
            };
        };

        viewModel.sessionsByDay(data.ScheduledSessions);

        var futureSessions = ko.utils.arrayFilter(viewModel.sessions(), (session) => session.ScheduledDateTime.clone().addHours(1).isFuture());
        if (!futureSessions.length) {
            viewModel.showOld(true);
        }

        viewModel.favoriteSessionIDs.subscribe(function(newValue) {
            viewModel.instantOfUpdate = new Date().valueOf();
            amplify.store("favoriteSessionIDs", newValue);
            amplify.store("instantOfUpdate", viewModel.instantOfUpdate);
            saveToDropbox();
        });

        viewModel.selectedDay.subscribe(function(newValue) {
            if (newValue) {
                amplify.store("selectedDateValue", newValue.Day.valueOf());
            }
        });

    });

    function saveToDropbox() {
        var client = viewModel.dropboxClient();
        if (client) {
            var data = {
                favoriteSessionIDs: viewModel.favoriteSessionIDs(),
                instantOfUpdate: viewModel.instantOfUpdate
            };
            viewModel.savingToDropbox(true);
            client.writeFile("data.json", JSON.stringify(data), function(error, stat) {
                viewModel.savingToDropbox(false);
            });
        }
    }

    function readFromDropbox() {
        var dropboxClient: Dropbox.Client = viewModel.dropboxClient();
        dropboxClient.readFile("data.json", (error, dataString) => {
            if (!error) {
                let data: DropboxModel = JSON.parse(dataString);
                var favoriteSessionIDs = data.favoriteSessionIDs;
                if (data.instantOfUpdate > viewModel.instantOfUpdate) {
                    ko.utils.arrayForEach(viewModel.sessions(), function(session) {
                        session.isFavorite(favoriteSessionIDs.indexOf(session.Id) > -1);
                    });
                }
            }
        });
    }

    dropboxClient.authenticate({ interactive: false }, function(error, client: Dropbox.Client) {
        if (!error && dropboxClient.isAuthenticated()) {
            viewModel.dropboxClient(dropboxClient);
            readFromDropbox();
        }
    })

});