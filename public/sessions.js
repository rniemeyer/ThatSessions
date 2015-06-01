/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/knockout/knockout.d.ts"/>
/// <reference path="../typings/jquery/jquery.d.ts"/>
/// <reference path="../typings/dropboxjs/dropboxjs.d.ts"/>
/// <reference path="../typings/amplifyjs/amplifyjs.d.ts"/>
/// <reference path="../typings/bootstrap/bootstrap.d.ts"/>
/// <reference path="../typings/sugarjs/sugar.d.ts"/>
/**
 * ThatSessionsViewModel
 */
var ThatSessionsViewModel = (function () {
    function ThatSessionsViewModel() {
        var _this = this;
        this.sessionsByDay = ko.observableArray([]);
        this.showOld = ko.observable(false);
        this.search = ko.observable("");
        this.delayedSearch = ko.computed(this.search).extend({ throttle: 250 });
        this.onlyFavorites = ko.observable(false);
        this.showMap = ko.observable(false);
        this.showAbout = ko.observable(false);
        this.dropboxClient = ko.observable(null);
        this.savingToDropbox = ko.observable(false);
        //Computeds
        this.days = ko.computed(function () {
            var days = ko.utils.arrayFilter(_this.sessionsByDay(), function (day) { return _this.showOld() || day.Day >= Date.create("today"); });
            if (days.length) {
                var selectedDateValue = amplify.store("selectedDateValue");
                var selectedDay;
                if (selectedDateValue) {
                    selectedDay = ko.utils.arrayFirst(days, function (day) { return day.Day.valueOf() === selectedDateValue; });
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
            //var selectedCategories = ko.utils.arrayMap(this.selectedCategories(), function (category) { return category.name; });
            var selectedDay = _this.selectedDay();
            var search = _this.delayedSearch().toLowerCase();
            var selectedSessions = ko.utils.arrayFilter(_this.sessions(), function (session) {
                var searchResult = true;
                if (search) {
                    searchResult = false;
                    searchResult = (session.Title.toLowerCase().indexOf(search) > -1) || (session.Description.toLowerCase().indexOf(search) > -1);
                    searchResult = searchResult || !!ko.utils.arrayFirst(session.Speakers, function (person) {
                        return (person.FirstName.toLowerCase().indexOf(search) > -1) || (person.LastName.toLowerCase().indexOf(search) > -1);
                    });
                }
                var dateResult = selectedDay && session.ScheduledDateTime.clone().beginningOfDay().valueOf() === selectedDay.Day.valueOf();
                var timeResult = _this.showOld() || session.ScheduledDateTime.clone().addHours(1).isFuture();
                var favoritesResult = !_this.onlyFavorites() || session.isFavorite();
                //return ((selectedCategories.indexOf(session.Category) > -1) && searchResult);
                return (session.Accepted && dateResult && searchResult && favoritesResult && timeResult);
            });
            return selectedSessions.sortBy(function (session) { return session.ScheduledDateTime.valueOf() + parseInt(session.Level, 10); });
        });
    }
    ThatSessionsViewModel.prototype.connectDropbox = function () {
        if (this.dropboxClient()) {
            this.dropboxClient().authenticate();
        }
    };
    ThatSessionsViewModel.prototype.disconnectDropbox = function () {
        var _this = this;
        if (this.dropboxClient()) {
            this.dropboxClient().signOut(function (err) {
                if (!err) {
                    _this.dropboxClient(null);
                }
            });
        }
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
})();
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
    amplify.request("sessions", function (data) {
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
        viewModel.favoriteSessionIDs.subscribe(function (newValue) {
            viewModel.instantOfUpdate = new Date().valueOf();
            amplify.store("favoriteSessionIDs", newValue);
            amplify.store("instantOfUpdate", viewModel.instantOfUpdate);
            saveToDropbox();
        });
        viewModel.selectedDay.subscribe(function (newValue) {
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
            client.writeFile("data.json", JSON.stringify(data), function (error, stat) {
                viewModel.savingToDropbox(false);
            });
        }
    }
    function readFromDropbox() {
        var dropboxClient = viewModel.dropboxClient();
        dropboxClient.readFile("data.json", function (error, dataString) {
            if (!error) {
                var data = JSON.parse(dataString);
                var favoriteSessionIDs = data.favoriteSessionIDs;
                if (data.instantOfUpdate > viewModel.instantOfUpdate) {
                    ko.utils.arrayForEach(viewModel.sessions(), function (session) {
                        session.isFavorite(favoriteSessionIDs.indexOf(session.Id) > -1);
                    });
                }
            }
        });
    }
    dropboxClient.authenticate({ interactive: false }, function (error, client) {
        if (!error && dropboxClient.isAuthenticated()) {
            viewModel.dropboxClient(dropboxClient);
            readFromDropbox();
        }
    });
});
//# sourceMappingURL=sessions.js.map