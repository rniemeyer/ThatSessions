//Assumes knockoutjs and moment

SessionList = function (s) {
	for (var i = 0; s && i < s.length; i++) {
		s[i] = Session(s[i]);
	};
	var list = ko.observableArray(s);
	list.onlyFavorites = ko.observable(false);
	list.showOld = ko.observable(true);
	list.selected = list.filter(function (session) { //use knockout-projections
		var include = true;
		include = !list.onlyFavorites() || session.isFavorite();
		if (!list.showOld()) {
			var currentDate = moment();
			currentDate.subtract("hours", 1); //Also list sessions that are currently happening
			include = (session.ScheduledDateTime > currentDate);
		}
		return include;
	});
	return list;
};

Session = function (sessionObject) {
	//Only make the object a session if it isn't already
	if (!ko.isObservable(sessionObject.isFavorite)) {
		sessionObject.ScheduledDateTime = moment(sessionObject.ScheduledDateTime);
		sessionObject.isFavorite = ko.observable(false);
	}
	return sessionObject;
};
