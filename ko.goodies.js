//Assumes knockoutjs

ko.observable.fn.toggle = function() {
	var observable = this;
	return function() {
		observable(!observable());
	};
};

ko.observable.fn.set = function (value) {
	var observable = this;
	return function() {
		observable(value);
	};
};