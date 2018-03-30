function fadeOutAndRemove(element) {
	setTimeout(function () {
		element.fadeOut(function () {
			this.remove();
		});
	}, 6000);
}
