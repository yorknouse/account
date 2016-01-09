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
});