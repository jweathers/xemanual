$(function () {
    var procDirective = "proc-segment";
    var procDirectiveClass = "." + procDirective;
    $(document).ready(function () {
        var dirctivesEnabled = $("li.directive").length !== 0;
        showCameraIconIfDeviceHasCamera();
        $("button[type=button].directive.auto").on("click", function () {
            if ($(this).attr('disabled')) return;
            var input = $(document.createElement("input"));
            input.attr("type", "file");
            input.attr("accept","image/*");
            input.trigger("click");
            bindChange(input, $(this));
            return false;
        });

        var inputSerialNumberField = $("input[type=text].directive.manual");

        inputSerialNumberField.on('input',function () {
            enableValidateButton(this);
            showNextStep($(this), false);
        });

        inputSerialNumberField.each(function (index, inputField) {
            enableValidateButton(inputField);
        });

        $(".report-invalid-serial").on("click", function(e){
            e.preventDefault();
            e.stopPropagation();
            // iframe / document / main
            window.parent.window.parent.$(".help-link").click();
        });

        $(".back-to-capture").on("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var scrollTo = $($(this).parents("ol").find(".directive")[1]).offset().top;
            if (scrollTo !== undefined && scrollTo.length !== 0) {
                $("html, body").delay(10).animate({scrollTop: scrollTo}, 1000);
            }
        });

        function getValidateUrl(validateButton, serialNumber) {
            var batteryModule = $(validateButton).parents(procDirectiveClass).find(".battery-module-list");
            if (batteryModule.length === 0) {
                if (isRemoval(validateButton)) {
                    return "/topix/service/vehicle/batterypack/exists/" + serialNumber;
                }
                else {
                    return "/topix/service/vehicle/batterypack/replace/" + serialNumber;
                }
            }
            else {
                if (isRemoval(validateButton)) {
                    return "/topix/service/vehicle/batterymodule/exists/" + batteryModule.val() + "/" + serialNumber;
                }
                else {
                    var prevBatteryModule = $(validateButton).parents(procDirectiveClass).prev(procDirectiveClass).find(".battery-module-list");
                    return "/topix/service/vehicle/batterymodule/replace/" + prevBatteryModule.val() + "/" + batteryModule.val() + "/" + serialNumber;
                }
            }
        }

        function isRemoval(validateButton) {
            var prevProcSegment = validateButton.parents(procDirectiveClass).prev(procDirectiveClass);
            return prevProcSegment === undefined || prevProcSegment.length === 0;
        }

        $("input[type=button].directive.manual").on("click", function () {
            var thisButton = $(this);
            $(thisButton).parent().find(".directive_valid").hide();
            var serialNumber = thisButton.prev().val().trim();
            if (serialNumber === "") {
                thisButton.parent().find(".directive_invalid").show();
            }
            else {
                serialNumber = btoa(encodeURI(serialNumber));
                thisButton.parent().find(".directive_invalid").hide();
                $.ajax({
                    type: "GET",
                    dataType: "json",
                    url: getValidateUrl(thisButton, serialNumber),
                    cache: false,
                    success: function (data) {
                        if (data.result && data.result === true) {
                            thisButton.parent().find(".directive_valid").show();
                            showNextStep(thisButton, true);
                        }
                        else {
                            thisButton.parent().find(".directive_invalid").show();
                            showNextStep(thisButton, false);
                        }
                    },
                    error: function (data) {
                        thisButton.parent().find(".directive_invalid").show();
                        showNextStep(thisButton, false);
                    }
                });
            }
        });

        var batteryModuleList = $(".battery-module-list");
        if (batteryModuleList.length !== 0) {
            $.ajax({
                type: "GET",
                dataType: "json",
                url: "/topix/service/vehicle/batterymodule/list",
                cache: false,
                success: function (data) {
                    batteryModuleList.empty();
                    var index = 1;
                    for (var key in data.batterymodules) {
                        batteryModuleList.append("<option value=\"" + (index++) + "\">" + data.batterymodules[key] + "</option>");
                    }
                },
                error: function (data) {
                    batteryModuleList.empty();
                }
            });
        }
        if (batteryModuleList.on("change", function(){
            showNextStep($(this), false);
        }));

        if (dirctivesEnabled) {
            $(procDirectiveClass).each(function (directiveIndex) {
                if (directiveIndex > 0) {
                    $(this).hide();
                }
            });
        }
        else {
            $("li.directive-sublist").remove();
        }

        function showNextStep(validatedDirective, showNext)  {
            var directiveParent = $(validatedDirective).parents(procDirectiveClass);
            if (directiveParent !== undefined) {
                var foundNExtProc = false;
                var nextElem = directiveParent;
                while (!foundNExtProc) {
                    nextElem = nextElem.next();
                    if (nextElem !== undefined && nextElem.length !== 0) {
                        if (nextElem.hasClass(procDirective)) {
                            foundNExtProc = true;
                            nextElem.find(".directive_invalid, .directive_valid").hide();
                            nextElem.find("input[type=text]").val("");
                            if (showNext) {
                                nextElem.show();
                            }
                            else {
                                nextElem.hide();
                            }
                        }
                    }
                    else {
                        foundNExtProc = true;
                    }
                }
            }
        }

        function bindChange(inputFile, captureButton) {
            $(inputFile).on('change', function () {
                startProcessingImage(captureButton);
                $.ajax({
                    url: "/topix/service/vehicle/getVprToken",
                    dataType: "text",
                    cache: false,
                    success: function (data) {
                        var formData = new FormData();
                        formData.append('file', $(inputFile)[0].files[0]);
                        processFile(inputFile, captureButton, $(inputFile)[0].files[0], data);
                    },
                    error: function (data) {
                        stopProcessingImage(captureButton);
                        getSerialNumberInput(captureButton).val(barcodeCantBeDecodedMsg);
                    }
                });
            });
        }
    });

    function processFile(inputFile, captureButton, file, token) {
        if (!(/image/i).test(file.type)) {
            return false;
        }

        var reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onload = function (event) {
            var blob = new Blob([event.target.result]);
            window.URL = window.URL || window.webkitURL;
            var blobURL = window.URL.createObjectURL(blob);

            var image = new Image();
            image.src = blobURL;
            image.onload = function () {
                var compressed = compressImage(image);
                sendToBackend(inputFile, captureButton, dataURItoBlob(compressed), token);
            }
        };
    }

    function dataURItoBlob(dataURI) {
        var byteString = atob(dataURI.split(',')[1]);
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], {type: mimeString});
    }

    function compressImage(img) {
        var canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, img.width, img.height);
        return canvas.toDataURL("image/jpeg", 0.7);
    }

    function sendToBackend(inputFile, captureButton, file, token) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('token', token);
        var serialNumber = getSerialNumberInput(captureButton);
        $.ajax({
            url: vprUrl + '/decode',
            type: 'POST',
            data: formData,
            crossDomain: true,
            processData: false,
            contentType: false,
            success: function (data) {
                if (data.status === "DECODED") {
                    $(serialNumber).val(data.message);
                }
                else {
                    $(serialNumber).val(barcodeCantBeDecodedMsg);
                }
            },
            error: function (XMLHttpRequest) {
                $(serialNumber).val(barcodeCantBeDecodedMsg);
            },
            complete: function (data) {
                stopProcessingImage(captureButton);
                enableValidateButton(serialNumber);
            }
        });
    }

    function enableValidateButton(inputField) {
        if($(inputField).val().trim() === "") {
            $(inputField).next().attr("disabled", "disabled");
        }
        else {
            $(inputField).next().removeAttr("disabled");
        }
    }

    function showCameraIconIfDeviceHasCamera() {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        if (navigator.getUserMedia) {
            return true;
        }
        return false;
    }

    function getSerialNumberInput(captureButton) {
        return $(captureButton).parents("ol").find("input[type=text].directive.manual");
    }

    function startProcessingImage(captureButton) {
        $(captureButton).attr("disabled", "disabled");
        $(".spinner-wrapper").show();
    }

    function stopProcessingImage(captureButton) {
        $(captureButton).removeAttr("disabled");
        $(".spinner-wrapper").hide();
    }
});

