/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/knockout/knockout.d.ts"/>
/// <reference path="../typings/jquery/jquery.d.ts"/>
/// <reference path="../typings/dropboxjs/dropboxjs.d.ts"/>
/// <reference path="../typings/amplifyjs/amplifyjs.d.ts"/>
/// <reference path="../typings/bootstrap/bootstrap.d.ts"/>
/// <reference path="../typings/sugarjs/sugar.d.ts"/>
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
        this.dropboxClient = ko.observable(new Dropbox.Client({ key: "9keh9sopjf08vhi" }));
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
        this.dropboxClient().authenticate({ interactive: false });
    }
    ThatSessionsViewModel.prototype.connectDropbox = function () {
        this.dropboxClient().authenticate();
    };
    ThatSessionsViewModel.prototype.disconnectDropbox = function () {
        var _this = this;
        this.dropboxClient().signOut(function (err) {
            if (!err) {
                _this.dropboxClient(null);
            }
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
    var viewModel = new ThatSessionsViewModel();
    ko.applyBindings(viewModel);
    amplify.request.define("sessions", "ajax", { url: "/getSessions", type: "POST" });
    amplify.request("sessions", function (data) {
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
        getFavorites(function (favoriteSessionIDs) {
            viewModel.sessions().each(function (session) {
                session.isFavorite(favoriteSessionIDs && favoriteSessionIDs.indexOf(session.Id) > -1);
            });
            viewModel.favoriteSessionIDs.subscribe(function (newValue) {
                saveFavorites(newValue);
            });
        });
    });
    function getFavorites(callback) {
        var local = amplify.store("favorites") || {};
        var client = viewModel.dropboxClient();
        if (client && client.isAuthenticated()) {
            client.readFile("data.json", function (error, fileContents) {
                var dropbox = fileContents && JSON.parse(fileContents);
                if ((dropbox && dropbox.instantOfUpdate) > local.instantOfUpdate) {
                    callback(dropbox.favoriteSessionIDs);
                }
                else {
                    callback(local.favoriteSessionIDs);
                }
            });
        }
        else {
            callback(local.favoriteSessionIDs);
        }
    }
    function saveFavorites(favorites) {
        var data = {
            favoriteSessionIDs: favorites,
            instantOfUpdate: new Date().valueOf()
        };
        amplify.store("favorites", data);
        var dropboxClient = viewModel.dropboxClient();
        if (dropboxClient && dropboxClient.isAuthenticated()) {
            viewModel.savingToDropbox(true);
            dropboxClient.writeFile("data.json", JSON.stringify(data), function (error, stat) {
                viewModel.savingToDropbox(false);
            });
        }
    }
});
//# sourceMappingURL=sessions.js.map