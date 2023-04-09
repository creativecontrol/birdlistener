inlets = 1;
outlets = 2; // 0 = umenu 

currentTime = Date.now();
currentMode = 'a';
allFiles = [];
ratio = [3,2];

function mode(modeLetter) {
	if (modeLetter.lower == 'a' || modeLetter.lower == 'b' || modeLetter.lower == 'c') {
		currentMode = modeLetter.lower
	}
}

// Select a new index
function bang() {
	var index = null;
	if (currentMode == 'a') {
		// mode 'a' choose randomly from all files
		index = _getRandomInt(0, allFiles.length - 1);
	} else if (currentMode == 'b') {
		// select a random file from the list favoring the last dozen by ratio
		var newestFiles = 12;
		// select new or old first
		var selectNewer = _selectNewer(ratio);
		
		if (selectNewer) {
			// randomly from length
			index = _getRandomInt((allFiles.length-newestFiles), allFiles.length);
		} else {
			index = _getRandomInt(0, (allFiles.length-newestFiles));
		}
		
		
	} else if (currentMode == 'c') {
		// select a random file from the transcriptions since currentTime
		currentTime = Date.now();
		// find index of last file before current time
		var newFilesStart = _fileTimestampIndex(allFiles, currentTime);
		
		if (newFileStart) {
			// choose random integer between (0 and length - last index before) + last index before
			index = _getRandomInt(newFileStart, allFiles.length);
		} else {
			outlet(1, "No files newer than" + currentTime)
		}
	}
	
	if (index) {
		outlet(0, index);
	}
}

// set the ratio of recent to older playback in mode B and C
// first argument is ratio of new, second argument is ratio of old
function list(a) {
	ratio = [arguments[0], arguments[1]];
	
}

function _fileTimestampIndex(files, timestamp) {
	var firstFileAfterTimestamp = null;
	
	files.forEach(function (file, index) {
		// check timestamp against file.date
		if (file.date >= timestamp) {
			firstFileAfterTimestamp = index;
			return;
		}
	});
	
	return firstFileAfterTimestamp;
	
}

function _selectNewer(ratio) {
	var select = Math.random();
	var cutoff = _ratioCutoff(ratio);
	
	if (select < cutoff) {
		return true;
	}
	else {
		return false;
	}

}

function _ratioCutoff(ratio) {
	if (ratio[0] < ratio[1]) {
		return ratio[0]/ratio[1];
	} else {
		return 1/(ratio[0]/ratio[1]);
	}
}


function _getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _getFileTimestamp(filename) {
	return filename.split(/[\_\.]/)[1];
}

function read(path) {
	var folder = new Folder(path);
	allFiles = [];
	
	currentTime = Date.now();
	
	while (!folder.end) {
        // sort out hidden files and folders
        // and write others into an array
		if (
			folder.filename
			&& folder.filetype !="fold"
			&& folder.filename.indexOf(".") != 0
		) {
			// allFiles.push({ "name": folder.filename, date : d.getTime()});
			allFiles.push({ "name": folder.filename, date : _getFileTimestamp(folder.filename)});
		}
	
		folder.next();
	 }
     folder.close();
     // sort the array by date asc
	allFiles.sort(
		function(a, b){
			return a.date-b.date;
		}
	);
	
	outlet(0, "clear");
	for (f in allFiles) {
		post(allFiles[f].date)
		outlet(0, "append", allFiles[f]["name"]);
	}
}