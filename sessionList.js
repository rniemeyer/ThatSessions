//Assumes knockoutjs and moment

SessionList = function (list) {
	for (var i = 0; list && i < list.length; i++) {
		list[i] = new Session(list[i]);
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
	for (var prop in sessionObject) {
		if (sessionObject.hasOwnProperty(prop)) {
			this[prop] = sessionObject[prop];
		}
	}
	this.ScheduledDateTime = new moment(this.ScheduledDateTime);
	this.isFavorite = ko.observable(false);
};
