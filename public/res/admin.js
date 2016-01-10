var currentlyOperatingUser = null;

function showConfirmationBox(veil, title, body, confirm, cancel) {
    window.document.getElementById('modalTitle').innerHTML = title;
    window.document.getElementById('modalBody').innerHTML = body;
    window.document.getElementById('modalFooter').innerHTML = '';
    var cancelBtn = window.document.createElement('button');
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.setAttribute('class', 'btn btn-default');
    cancelBtn.appendChild(window.document.createTextNode('Cancel'));
    if (cancel == null) {
        cancelBtn.addEventListener('click', function () {
           $('#adminmodal').modal('hide');
        });
    } else {
        cancelBtn.addEventListener('click', cancel);
    }
    window.document.getElementById('modalFooter').appendChild(cancelBtn);
    var confirmBtn = window.document.createElement('button');
    confirmBtn.setAttribute('type', 'button');
    confirmBtn.setAttribute('class', 'btn btn-primary');
    confirmBtn.addEventListener('click', confirm);
    confirmBtn.appendChild(window.document.createTextNode('Confirm'));
    window.document.getElementById('modalFooter').appendChild(confirmBtn);
    $('#adminmodal').modal({'backdrop': veil, 'keyboard': false});
}

function showChangePasswordBox(veil, title, old, confirm, cancel) {
    window.document.getElementById('modalTitle').innerHTML = title;
    
    window.document.getElementById('modalBody').innerHTML = '';
    var form = window.document.createElement('form');
    form.setAttribute('id', 'changepasswordform');
    if (old) {
        var oldPassword = window.document.createElement('input');
        oldPassword.setAttribute('type', 'password');
        oldPassword.setAttribute('class', 'form-control');
        oldPassword.setAttribute('id', 'oldpassword');
        oldPassword.setAttribute('name', 'oldpassword');
        oldPassword.setAttribute('placeholder', 'New password');
        oldPassword.setAttribute('required', 'required');
        form.appendChild(oldPassword);
    }
    var newPassword = window.document.createElement('input');
    newPassword.setAttribute('type', 'password');
    newPassword.setAttribute('class', 'form-control');
    newPassword.setAttribute('id', 'newpassword');
    newPassword.setAttribute('name', 'newpassword');
    newPassword.setAttribute('placeholder', 'New password');
    newPassword.setAttribute('required', 'required');
    form.appendChild(newPassword);
    var confirmPassword = window.document.createElement('input');
    confirmPassword.setAttribute('type', 'password');
    confirmPassword.setAttribute('class', 'form-control');
    confirmPassword.setAttribute('id', 'confirmpassword');
    confirmPassword.setAttribute('name', 'confirmpassword');
    confirmPassword.setAttribute('placeholder', 'Confirm password');
    confirmPassword.setAttribute('required', 'required');
    form.appendChild(confirmPassword);
    window.document.getElementById('modalBody').appendChild(form);
    
    window.document.getElementById('modalFooter').innerHTML = '';
    var cancelBtn = window.document.createElement('button');
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.setAttribute('class', 'btn btn-default');
    cancelBtn.appendChild(window.document.createTextNode('Cancel'));
    if (cancel == null) {
        cancelBtn.addEventListener('click', function () {
           $('#adminmodal').modal('hide');
        });
    } else {
        cancelBtn.addEventListener('click', cancel);
    }
    window.document.getElementById('modalFooter').appendChild(cancelBtn);
    var confirmBtn = window.document.createElement('button');
    confirmBtn.setAttribute('type', 'button');
    confirmBtn.setAttribute('class', 'btn btn-primary');
    confirmBtn.addEventListener('click', function () {
        if (window.document.getElementById('newpassword').value !== window.document.getElementById('confirmpassword').value) {
            alert('New and confirmed password did not match');
            return false;
        }
        confirm();
    });
    confirmBtn.appendChild(window.document.createTextNode('Change Password'));
    window.document.getElementById('modalFooter').appendChild(confirmBtn);
    $('#adminmodal').modal({'backdrop': veil, 'keyboard': false});
}

function showLongTextBox(veil, title, old, confirm, cancel) {
    window.document.getElementById('modalTitle').innerHTML = title;
    
    window.document.getElementById('modalBody').innerHTML = '';
    var form = window.document.createElement('form');
    form.setAttribute('id', 'longtextform');
    var longtext = window.document.createElement('textarea');
    longtext.setAttribute('class', 'form-control');
    longtext.setAttribute('id', 'longtext');
    longtext.setAttribute('name', 'longtext');
    longtext.appendChild(window.document.createTextNode(old));
    form.appendChild(longtext);
    window.document.getElementById('modalBody').appendChild(form);
    
    window.document.getElementById('modalFooter').innerHTML = '';
    var cancelBtn = window.document.createElement('button');
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.setAttribute('class', 'btn btn-default');
    cancelBtn.appendChild(window.document.createTextNode('Cancel'));
    if (cancel == null) {
        cancelBtn.addEventListener('click', function () {
           $('#adminmodal').modal('hide');
        });
    } else {
        cancelBtn.addEventListener('click', cancel);
    }
    window.document.getElementById('modalFooter').appendChild(cancelBtn);
    var confirmBtn = window.document.createElement('button');
    confirmBtn.setAttribute('type', 'button');
    confirmBtn.setAttribute('class', 'btn btn-primary');
    confirmBtn.addEventListener('click', confirm);
    confirmBtn.appendChild(window.document.createTextNode('Confirm'));
    window.document.getElementById('modalFooter').appendChild(confirmBtn);
    $('#adminmodal').modal({'backdrop': veil, 'keyboard': false});
}

window.document.addEventListener('DOMContentLoaded', function () {
    for (var i = 0; i < window.document.getElementsByClassName('na-suspenduser').length; i++) {
        window.document.getElementsByClassName('na-suspenduser')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-idusers');
            showConfirmationBox(true, 'Suspend this user?', '', function () {window.location.href='/admin/users/suspend?idusers=' + currentlyOperatingUser;});
        });
    }
    for (var i = 0; i < window.document.getElementsByClassName('na-unsuspenduser').length; i++) {
        window.document.getElementsByClassName('na-unsuspenduser')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-idusers');
            showConfirmationBox(true, 'Unsuspend this user?', 'They\'ll need to review the terms and conditions next time they log in', function () {window.location.href='/admin/users/unsuspend?idusers=' + currentlyOperatingUser;});
        });
    }
    for (var i = 0; i < window.document.getElementsByClassName('na-deleteuser').length; i++) {
        window.document.getElementsByClassName('na-deleteuser')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-idusers');
            showConfirmationBox(true, 'Delete this user?', 'This will remove their logins, name and email, but their nickname and other content will remain.', function () {window.location.href='/admin/users/delete?idusers=' + currentlyOperatingUser;});
        });
    }
    
    for (var i = 0; i < window.document.getElementsByClassName('na-deletesession').length; i++) {
        window.document.getElementsByClassName('na-deletesession')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-sessionid');
            showConfirmationBox(true, 'End this session?', 'The user will be logged out and anything they were doing will be lost.', function () {window.location.href='/admin/sessions/delete?sessionid=' + currentlyOperatingUser;});
        });
    }
    
    for (var i = 0; i < window.document.getElementsByClassName('na-apipassword').length; i++) {
        window.document.getElementsByClassName('na-apipassword')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-idapiauth');
            showChangePasswordBox(true, 'Change Password', false, function () {window.document.getElementById('changepasswordform').setAttribute('method', 'post');window.document.getElementById('changepasswordform').setAttribute('action', '/admin/api/password?idapiauth=' + currentlyOperatingUser);window.document.getElementById('changepasswordform').submit();});
        });
    }
    for (var i = 0; i < window.document.getElementsByClassName('na-apiurls').length; i++) {
        window.document.getElementsByClassName('na-apiurls')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-idapiauth');
            showLongTextBox(true, 'Change permitted URLs', this.parentElement.parentElement.getElementsByTagName('td')[2].innerHTML, function () {window.document.getElementById('longtextform').setAttribute('method', 'post');window.document.getElementById('longtextform').setAttribute('action', '/admin/api/urls?idapiauth=' + currentlyOperatingUser);window.document.getElementById('longtextform').submit();});
        });
    }
    for (var i = 0; i < window.document.getElementsByClassName('na-deleteapi').length; i++) {
        window.document.getElementsByClassName('na-deleteapi')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-idapiauth');
            showConfirmationBox(true, 'Delete this API user?', 'This will terminate their API access, and the same login can\'t be generated again.', function () {window.location.href='/admin/api/delete?idapiauth=' + currentlyOperatingUser;});
        });
    }
    
    for (var i = 0; i < window.document.getElementsByClassName('na-deletecontent').length; i++) {
        window.document.getElementsByClassName('na-deletecontent')[i].addEventListener('click', function (e) {
            currentlyOperatingUser = this.parentElement.parentElement.getAttribute('data-idcontent');
            showConfirmationBox(true, 'Delete this content?', 'This will become instantly inaccesible', function () {window.location.href='/admin/content/delete?idcontent=' + currentlyOperatingUser;});
        });
    }
});