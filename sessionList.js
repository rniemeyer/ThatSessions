//Assumes knockoutjs and moment

SessionList = function (s) {
	for (var i = 0; s && i < s.length; i++) {
		s[i] = Session(s[i]);
	};
	var list = ko.observableArray(s);
	list.onlyFavorites = ko.observable(false);
	list.showOld = ko.observable(true);
	list.days = ko.computed(function days() {
		var days = ko.utils.arrayMap(list(),
			function days$arrayMap(session)
			{
				var sessionDateTime = moment(session.ScheduledDateTime);
				if (list.showOld() || moment(sessionDateTime).add("hours", 1).isAfter())
				{
					return sessionDateTime.startOf("day").valueOf();
				}
			});
		days = ko.utils.arrayFilter(days, function (day) { return day; }); //drop any items that are null or undefined
		var distinctDays = ko.utils.arrayGetDistinctValues(days);
		distinctDays.sort();
		distinctDays = ko.utils.arrayMap(distinctDays,
			function (dayMs)
			{
				return { date: moment(dayMs), selected: ko.observable(false) };
			});
		//Ensure mutual exclusivity in selection
		ko.utils.arrayForEach(distinctDays,
			function(day)
			{
				day.selected.subscribe(function(value)
				{
					if (value)
					{
						for (var i = 0; i < distinctDays.length; i++) {
							if (distinctDays[i] !== day)
							{
								distinctDays[i].selected(false);
							}
						};
					}
				});
			});
		if (distinctDays.length)
		{
			distinctDays[0].selected(true);
		}
		return distinctDays;
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
