function fadeOutAndRemove(element) {
	setTimeout(function () {
		element.fadeOut(function () {
			this.remove();
		});
	}, 6000);
}

function getParameterByName(name) {
	name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var regexS = "[\\?&;]"+name+"=([^&;#]*)";
	var regex = new RegExp(regexS);
	var url = window.location.href;
	var result = regex.exec(url);
	if (result === null) {
		return "";
	} else {
		return decodeURIComponent(result[1].replace(/\+/g, " "));
	}
}
