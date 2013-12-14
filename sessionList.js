//Assumes knockoutjs and moment

SessionList = function (list) {
	for (var i = 0; list && i < list.length; i++) {
		list[i] = Session(list[i]);
	};
	var obj = ko.observableArray(list);
	obj.favorites = ko.computed(function () {
		return ko.utils.arrayFilter(this, function(session) {
			return session.isFavorite();
		});
	}, obj); //second param to ko.computed becomes 'this' in function
	return obj;
};

Session = function (sessionObject) {
	//Only make the object a session if it isn't already
	if (!ko.isObservable(sessionObject.isFavorite)) {
		sessionObject.ScheduledDateTime = new moment(sessionObject.ScheduledDateTime);
		sessionObject.isFavorite = ko.observable(false);
	}
	return sessionObject;
};
