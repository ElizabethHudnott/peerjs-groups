function formatAsHTML(text) {
	var formatted;
	formatted = escapeHTML(text);
	// *emphasis*
	formatted = formatted.replace(/(^|\s)\*([^\s*][^*]*)\*/g, '$1<strong>$2</strong>');
	// hyperlinks
	formatted = formatted.replace(/http(s)?:\/\/[\w$\-.+!*(),;/?=&%~\[\]]+/g, formatURL);
	// hashtags
	formatted = formatted.replace(
		/(^|\s)#(\w{3,})/g,
		'$1<a href="https://twitter.com/search?src=typd&q=%23$2" target="_blank">#$2</a>'
	);
	return formatted;
}

function formatURL(url) {
	var punctuation, essentialPunctuation, match, url2, maxWidth;
	punctuation = url.match(/([,;.?!)]*)$/)[1];
	if (punctuation === '') {
		essentialPunctuation = '';
	} else {
		url = url.slice(0, -(punctuation.length));
		essentialPunctuation = punctuation.match(/([?!)].*)?/)[1];
		if (essentialPunctuation === undefined) {
			essentialPunctuation = '';
		}
	}

	match = url.match(youTubeURL);
	if (match !== null) {
		return '<div class="iframe-container">' +
			'<iframe width="640" height="360" src="https://www.youtube-nocookie.com/embed/' +
			match[2] +
			(match[4] === undefined? '' : '?' + match[4]) +
			'" allow="encrypted-media" allowfullscreen="true"></iframe></div>' +
			essentialPunctuation;
	}

	match = url.match(slideShareURL);
	if (match !== null) {
		url2 = 'https://www.slideshare.net/' + match[2];
		maxWidth = Math.floor(chatWindow.width());
		$.ajax({
			url:
				'http://www.slideshare.net/api/oembed/2?url=' + 
				encodeURIComponent(url2) + 
				'&maxwidth=' + maxWidth + 
				'&format=json',
			dataType: 'jsonp',
			success: function (data) {
				var width = Math.min(maxWidth, Math.max(629, data.width));
				var height = Math.round(width * data.height / data.width);
				var match = data.html.match(/\ssrc=["']?([^"'>\s]*)/);
				$('.iframe-container[data-oembed="' + url2 + '"]').html(`
					<iframe
						src="${match[1]}"
						width="${width}"
						height="${height}"
						allowfullscreen="true"
					>
					</iframe>
					<figcaption>
						<a href="${url2}" target="_blank">${data.title}</a>
					</figcaption>
				`);
			}
		});
		return '<figure class="iframe-container" data-oembed="' +
			url2 +
			'"></figure>' +
			essentialPunctuation;
	}

	if (imageFileExtensions.test(url)) {
		return `<a href="${url}" target="_blank"><img src="${url}"/></a>${essentialPunctuation}`;
	}

	return '<a href="' + 
		url +
		'" target="_blank">' +
		url.replace(/[&;].*/, '&amp;&hellip;') +
		'</a>' +
		punctuation;
}
