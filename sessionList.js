//Assumes knockoutjs and moment

SessionList = function (s) {
	for (var i = 0; s && i < s.length; i++) {
		s[i] = Session(s[i]);
	};
	var list = ko.observableArray(s);
	list.onlyFavorites = ko.observable(false);
	list.showOld = ko.observable(true);
	list.days = ko.computed(function days() {
		var sessionList = list();

		var days = [];
		for (var i = 0; i < sessionList.length; i++) {
			var sessionDateTime = moment(sessionList[i].ScheduledDateTime); //Make a clone that we can modify
			if (list.showOld() || moment(sessionDateTime).add("hours", 1).isAfter())
			{
				//Include this session's date in the days array
				sessionDateTime.startOf("day");
				if (!days.some(function(day) { return sessionDateTime.isSame(day.date); }))
				{
					//This date isn't in the days array yet
					days.push({ date: sessionDateTime, selected: ko.observable(false) });
				}
			}
		};
		days.sort(function (a,b) { return a.date.diff(b.date); });

		//Ensure mutual exclusivity in selection
		ko.utils.arrayForEach(days,
			function(day) {
				day.selected.subscribe(function(value) {
					if (value) {
						for (var i = 0; i < days.length; i++) {
							if (days[i] !== day) {
								days[i].selected(false);
							}
						};
					}
				});
			});

		if (days.length)
		{
			days[0].selected(true);
		}
		return days;
	});
	list.selectedDay = ko.computed(function selectedDay() 
	{
		return ko.utils.arrayFirst(list.days(), function(day) { return day.selected(); });
	});
	list.selected = list.filter(function selected(session) { //use knockout-projections
		var include = true;
		include = !list.onlyFavorites() || session.isFavorite();
		if (!list.showOld()) {
			var currentDate = moment();
			currentDate.subtract("hours", 1); //Also list sessions that are currently happening
			include = include && (session.ScheduledDateTime > currentDate);
		}
		include = include && moment(session.ScheduledDateTime).startOf("day").isSame(list.selectedDay().date);
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
