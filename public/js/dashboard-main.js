import {
  fetchAssignTableForReservation,
  fetchInitOrder,
  fetchTableOrder,
  fetchAddNewCustomer,
} from "./fetch-operation.js";
import { currentTime } from "./utils/clock.js";
import {
  createYesNoModal,
  createTableModal,
  createFormModal,
} from "./utils/modal.js";
import NotificationQueue from "./utils/notify.js";
// parse global variable
const tablesData = tables;
const reservationsData = reservations;
const allNewCustomerData = newCustomers;
let newCustomerData = [];
let chosenReservation = null;
let chosenNewCustomer = null;
// Helpers
allNewCustomerData.forEach((cus) => {
  if (cus.state === "UNASSIGNED") {
    newCustomerData.push(cus);
  }
});

function reservationOnClick(event) {
  if (
    chosenReservation != null &&
    chosenReservation.id == event.currentTarget.id
  ) {
    chosenReservation.classList.remove("chosen");
    chosenReservation = null;
    unPopupTables();
  } else {
    if (chosenReservation != null) {
      chosenReservation.classList.remove("chosen");
    }
    chosenReservation = event.currentTarget;
    chosenReservation.classList.add("chosen");
    unPopupTables();
    const reservation = findById(reservationsData, chosenReservation.id);
    if (reservation != null && reservation.state == "READY") {
      popUpMatchedTables(chosenReservation);
    }
  }
}

function newCustomerOnclick(event) {
  if (
    chosenNewCustomer != null &&
    chosenNewCustomer.id === event.currentTarget.id
  ) {
    chosenNewCustomer.classList.remove("chosen");
    chosenNewCustomer = null;
    unPopupTables();
  } else {
    if (chosenNewCustomer != null) {
      chosenNewCustomer.classList.remove("chosen");
    }
    chosenNewCustomer = event.currentTarget;
    chosenNewCustomer.classList.add("chosen");
    if (isThereUnclocedRes()) {
      createYesNoModal(
        "Cảnh báo: \nVẫn còn đơn đang ở trạng thái unlocked !",
        () => {
          unPopupTables();
          chosenNewCustomer.classList.remove("chosen");
        },
        "Hủy",
        "Tiếp tục"
      );
    }

    unPopupTables();
    const newCustomer = findNewCustomerById(chosenNewCustomer.id);
    popUpMatchedTablesForNewCus(newCustomer);
  }
}

function tableOnClick(event) {
  const table = findById(tablesData, event.currentTarget.id);
  let reservation = findById(
    reservationsData,
    chosenReservation ? chosenReservation.id : ""
  );
  if (
    chosenReservation != null &&
    reservation.state == "READY" &&
    event.currentTarget.classList.contains("popup")
  ) {
    const title = `Bạn có muốn gán <strong>Bàn số ${table.tableNumber}</strong> 
                cho <strong>${reservation.customer.firstName}</strong>?`;
    createYesNoModal(title, async () => {
      let response = await fetchAssignTableForReservation(
        chosenReservation.id,
        table.id
      );
      chosenReservation = null;

      console.log("Fetch - Assign table for reservation");
      response = await response.json();
      const updatedReservation = response.reservation;
      if (updatedReservation) {
        updateReservations(updatedReservation);
        NotificationQueue.enqueue({
          status: "success",
          title: `Gán bàn thủ công`,
          text: `Bàn số ${updatedReservation.assignedTable.tableNumber}
                     đã gán cho ${updatedReservation.customer.firstName}`,
          updatedReservation: updatedReservation,
          callback: function lockTable() {
            unPopupTables();
            lockedTableForReservation(this.updatedReservation);
          },
        });
      } else {
        NotificationQueue.enqueue({
          status: "error",
          title: `Gán bàn thủ công`,
          text: `Bàn số ${updatedReservation.assignedTable.tableNumber}
                     gán thất bại, vui lòng tải lại trang!`,
        });
      }
    });
  } else if (
    table.state == "LOCKED" &&
    !chosenNewCustomer &&
    !chosenReservation
  ) {
    for (let i = 0; i < reservationsData.length; i++) {
      const element = reservationsData[i];
      if (element.assignedTableId == table.id) {
        reservation = element;
        break;
      }
    }
    const title = `Bạn có muốn khởi tạo đơn hàng tại <strong>Bàn số ${table.tableNumber}</strong> 
                cho khách hàng <strong>${reservation.customer.firstName}</strong>?`;

    createYesNoModal(title, async () => {
      const response = await fetchInitOrder(reservation.id, "", table.id);
      let orderedTable = await response.json();
      const order = orderedTable.order;
      console.log("Order for booked customer: ");
      console.log(order);
      if (order) {
        NotificationQueue.enqueue({
          status: "success",
          title: `Khởi tạo đơn hàng`,
          text: `Bàn số  ${table.tableNumber} khởi tạo thành công`,
          order: order,
          callback: function orderTable() {
            initOrderTable(this.order);
          },
        });
      } else {
        NotificationQueue.enqueue({
          status: "error",
          title: `Khởi tạo đơn hàng`,
          text: `Bàn số  ${table.tableNumber} khởi tạo thất bại, vui lòng tải lại trang!`,
        });
      }
    });
  }
  // init order for new customers
  else if (
    chosenNewCustomer != null &&
    event.currentTarget.classList.contains("popup")
  ) {
    const curNewCustomer = findNewCustomerById(chosenNewCustomer.id);
    const title = `Bạn có muốn khởi tạo đơn hàng tại <strong>Bàn số ${table.tableNumber}</strong> 
                cho khách hàng thứ <strong>${curNewCustomer.ordinamNumber}</strong>?`;

    createYesNoModal(title, async () => {
      const response = await fetchInitOrder("", chosenNewCustomer.id, table.id);
      let orderedTable = await response.json();
      const order = orderedTable.order;
      console.log("Order for new customer: ");
      console.log(order);

      unPopupTables();
      const curNewCustomerDiv = document.getElementById(chosenNewCustomer.id);
      chosenNewCustomer = null;
      const curIngressTable = document.getElementById(table.id);
      curNewCustomerDiv.remove();
      curIngressTable.classList.remove("unlock");

      if (order) {
        NotificationQueue.enqueue({
          status: "success",
          title: `Khởi tạo đơn hàng`,
          text: `Bàn số ${table.tableNumber} khởi tạo thành công`,
          order: order,
          callback: function orderTable() {
            initOrderTable(this.order);
          },
        });
      } else {
        NotificationQueue.enqueue({
          status: "error",
          title: `Khởi tạo đơn hàng`,
          text: `Bàn số ${table.tableNumber} khởi tạo thất bại, vui lòng tải lại trang!`,
        });
      }
    });
  }
  // can't choose invalid table
  else if (chosenNewCustomer || chosenReservation) {
    const title = `Bạn không thể chọn bàn này.`;
    createYesNoModal(
      title,
      () => {
        console.log("Bye bye");
      },
      "",
      "Quay lại",
      true
    );
  }
  // get info
  else {
    fetchTableOrder(table.id)
      .then((response) => response.json())
      .then((data) => {
        createTableModal(data);
      });
  }
}

function addNewCustomerOnClick(event) {
  const title = "Vui lòng nhập thông tin của khách vừa vào!";
  createFormModal(title, async () => {
    const inputNumberOfSeats = document.getElementById(
      "addNewCustomerInput"
    ).value;
    let curNewCustomerOrdinam = 0;
    if (allNewCustomerData.length > 0) {
      curNewCustomerOrdinam =
        allNewCustomerData[allNewCustomerData.length - 1].ordinamNumber + 1;
    }
    let response = await fetchAddNewCustomer(
      inputNumberOfSeats,
      curNewCustomerOrdinam
    );
    console.log("Fetch - Create new customer");
    response = await response.json();
    const newCustomer = response.newCustomer;
    updateNewCustomer(newCustomer);
    if (newCustomer) {
      NotificationQueue.enqueue({
        status: "success",
        title: `Tạo khác hàng mới`,
        text: `Khách hàng số ${newCustomer.ordinamNumber} đã được tạo thành công`,
        updatedNewCustomer: newCustomer,
        callback: function updateNewCustmer() {
          // update new customer
          console.log("Update UI");
        },
      });
    } else {
      NotificationQueue.enqueue({
        status: "error",
        title: `Tạo khác hàng mới`,
        text: `Khách hàng số ${newCustomer.ordinamNumber} tạo 
        thất bại, vui lòng tải lại trang!`,
      });
    }
  });
}

function popUpMatchedTables(currentTarget) {
  const id = currentTarget.id;
  let curReservation;

  // Get current reservation object by id
  for (let index = 0; index < reservationsData.length; index++) {
    const element = reservationsData[index];
    if (element.id == id) {
      curReservation = element;
      break;
    }
  }

  // Pop up all tables available for this reservation
  tablesData.map((table) => {
    if (
      table.numberOfSeats >= curReservation.numberOfPeople &&
      table.state == "FREE"
    ) {
      const tableElement = document.getElementById(table.id);
      if (!tableElement.classList.contains("popup")) {
        tableElement.classList.add("popup");
      } else {
        tableElement.classList.remove("popup");
      }
    }
  });
}

function popUpMatchedTablesForNewCus(currentTarget) {
  const id = currentTarget.customerId;
  let curNewCus;
  curNewCus = findNewCustomerById(id);

  // Pop up all tables available for this reservation
  tablesData.map((table) => {
    if (table.numberOfSeats >= curNewCus.numOfSeats && table.state == "FREE") {
      const tableElement = document.getElementById(table.id);
      if (!tableElement.classList.contains("popup")) {
        tableElement.classList.add("popup");
      } else {
        tableElement.classList.remove("popup");
      }
    }
  });
}

function unPopupTables() {
  const tables = document.getElementsByClassName("main-table-item");
  for (let i = 0; i < tables.length; i++) {
    tables[i].classList.remove("popup");
  }
}

function findById(list, id) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id == id) return list[i];
  }
  return null;
}

function findNewCustomerById(id) {
  for (let i = 0; i < newCustomerData.length; i++) {
    if (newCustomerData[i].customerId === id) {
      return newCustomerData[i];
    }
  }
}
// For socket communication

function updateReservations(updatedReservation) {
  console.log("Update reservations data");
  for (let i = 0; i < reservationsData.length; i++) {
    if (reservationsData[i].id == updatedReservation.id) {
      reservationsData[i] = updatedReservation;
      break;
    }
  }
}

function updateTables(updatedTable) {
  console.log("---Update tables data---");
  console.log(updatedTable);
  for (let i = 0; i < tablesData.length; i++) {
    if (tablesData[i].id === updatedTable.id) {
      tablesData[i] = updatedTable;
      break;
    }
  }
}

function assignReservation(updatedReservation) {
  // console.log(updatedReservation)
  console.log("Update reservation after assign");
  const element = document.getElementById(updatedReservation.id);
  element.classList.add("locked");

  element.querySelector("button").innerHTML = `Bàn ${updatedReservation.assignedTable.tableNumber}`

  // Create locked icon
  const icon = document.createElement("i");
  icon.classList.add("fa-solid", "fa-lock");
  element.appendChild(icon);
}

function updateNewCustomer(newCustomer) {
  // add to current data
  allNewCustomerData.push(newCustomer);
  newCustomerData.push(newCustomer);

  const divNewCustomer = document
    .getElementById("new-customers")
    .querySelector(".list-new-customers");
  const unassignedDiv = document.createElement("div");
  divNewCustomer.appendChild(unassignedDiv);
  unassignedDiv.classList.add("newCustomer-unassigned");
  unassignedDiv.setAttribute("id", newCustomer.customerId);

  let ele = document.createElement("h3");
  unassignedDiv.appendChild(ele);
  ele.innerHTML = `Số thứ tự ${newCustomer.ordinamNumber}`;

  ele = document.createElement("p");
  unassignedDiv.appendChild(ele);
  ele.innerHTML = `${newCustomer.numOfSeats} người`;

  // add event listenr
  unassignedDiv.addEventListener("click", newCustomerOnclick);
}

function freeReservation(updatedReservation) {
  console.log("Unlock reservation for manually locking");
  const element = document.getElementById(updatedReservation.id);
  element.classList.remove("locked");
  element.classList.add("unlock");

  // Create locked icon
  const icon = document.createElement("i");
  icon.classList.add("fa-solid", "fa-lock-open");
  element.appendChild(icon);
}

function lockedTableForReservation(updatedReservation) {
  console.log("Locked table for reservation ", updatedReservation);
  updateTables(updatedReservation.assignedTable);
  console.log("------------------Table after update-----------------");
  console.log(findById(tablesData, updatedReservation.assignedTable.id));
  const reservationElement = document.getElementById(updatedReservation.id);

  if (reservationElement) {
    reservationElement.remove();
  }
  // if (reservationElement.classList.contains("locked")) {
  //     reservationElement.classList.remove("locked")
  // }
  // if (reservationElement.classList.contains("unlock")) {
  //     reservationElement.classList.remove("unlock")
  // }
  // reservationElement.classList.add("done")

  // const icon = reservationElement.getElementsByTagName("i")[0]
  // reservationElement.removeChild(icon)

  const tableElement = document.getElementById(
    updatedReservation.assignedTableId
  );
  tableElement.classList.add("locked");
  tableElement.classList.remove("unlock");
  tableElement.querySelector(".main-table-item-right > h2").innerHTML =
    updatedReservation.customer.firstName;
}

function initOrderTable(updatedTable) {
  const curTime = new Date(updatedTable.arrivalTime);
  console.log("Locked table for reservation ", updatedTable);
  updateTables(updatedTable.table);

  const tableElement = document.getElementById(updatedTable.tableId);
  tableElement.classList.remove("locked");
  let rightTableItem = tableElement.querySelector(".main-table-item-right");
  let rightTableItemH2 = tableElement.querySelector(
    ".main-table-item-right > h2"
  );
  rightTableItem.removeChild(rightTableItemH2);

  let divElement = document.createElement("div");
  rightTableItem.appendChild(divElement);

  let pElement = document.createElement("p");
  divElement.appendChild(pElement);
  pElement.innerHTML = "Vào lúc:";

  pElement = document.createElement("p");
  divElement.appendChild(pElement);
  pElement.innerHTML = curTime.getHours() + ":" + curTime.getMinutes();

  divElement = document.createElement("div");
  rightTableItem.appendChild(divElement);

  pElement = document.createElement("p");
  divElement.appendChild(pElement);
  pElement.innerHTML = "Dự kiến rời:";

  pElement = document.createElement("p");
  divElement.appendChild(pElement);
  pElement.innerHTML =
    String(curTime.getHours() + 1) + ":" + curTime.getMinutes();

  pElement = document.createElement("p");
  rightTableItem.appendChild(pElement);
  pElement.setAttribute("id", "remainTime" + updatedTable.tableId);
  pElement.innerHTML = `Con <span>${Math.round(
    (curTime - new Date() + 3600000) / 60000
  )}</span> phut`;
  countdown(updatedTable.tableId);
}
const timeoutTable = 3000;

function countdown(id) {
  const timer = setInterval(() => {
    const tableEle = document.getElementById(id);
    const timeEle = tableEle.querySelector(".main-table-item-right p span");
    // const time = ele.querySelector("span");
    const newTime = Number(timeEle.innerText) - 1;
    timeEle.innerHTML = newTime;

    if (newTime == 0) {
      clearInterval(timer);
      timeEle.closest("p").remove();
    }
  }, timeoutTable);
}

function freeTable(updatedTable) {
  console.log("Free table ", updatedTable);
  updateTables(updatedTable);
  const tableElement = document.getElementById(updatedTable.id);
  tableElement.classList.add("unlock");
  let rightEle = tableElement.querySelector(".main-table-item-right");
  rightEle.remove();

  rightEle = document.createElement("div");
  rightEle.classList.add("main-table-item-right");
  rightEle.innerHTML = "<h2> Đang trống </h2>";

  tableElement.appendChild(rightEle);
}

function isThereUnclocedRes() {
  for (let i = 0; i < reservationsData.length; i++) {
    if (reservationsData[i].state === "READY") {
      return 1;
    }
  }
  return 0;
}
// onlick event for all reservation item
const listBookedCustomers = document.getElementsByClassName(
  "ordered-customers-item"
);

for (let i = 0; i < listBookedCustomers.length; i++) {
  listBookedCustomers[i].addEventListener("click", reservationOnClick);
}

const listNewCustomers = document.getElementsByClassName(
  "newCustomer-unassigned"
);
for (let i = 0; i < listNewCustomers.length; i++) {
  listNewCustomers[i].addEventListener("click", newCustomerOnclick);
}

const listTables = document.getElementsByClassName("main-table-item");
for (let i = 0; i < listTables.length; i++) {
  const element = listTables[i];
  element.addEventListener("click", tableOnClick);
}

const addNewCustomerButton = document.getElementById(
  "add-new-customers-button"
);
addNewCustomerButton.addEventListener("click", addNewCustomerOnClick);

const socket = io();

socket.on("notification", (noti) => {
  // console.log(noti)
  noti = JSON.parse(noti);
  noti.callback = function notiCallback() {
    if (this.updatedReservation) {
      updateReservations(this.updatedReservation);
    }
    switch (this.type) {
      case "AUTO_ASSIGN":
        if (this.status == "success") {
          assignReservation(this.updatedReservation);
        }
        break;
      case "AUTO_UNLOCK":
        if (this.status == "success") {
          lockedTableForReservation(this.updatedReservation);
        } else if (this.status == "warning") {
          freeReservation(this.updatedReservation);
        }
        break;
      case "DONE_ORDER":
        if (this.status == "success") {
          freeTable(this.updatedTable);
          break;
        }
    }
  };

  NotificationQueue.enqueue(noti);
});

socket.on("refresh page", (message) => {
  console.log("__ Refresh! __ ", message);
  location.reload();
});

// class="main-table-item locked"
window.onload = () => {
  const tables = document.querySelectorAll(".main-table-item");
  tables.forEach((table) => {
    if (
      !table.classList.contains("locked") &&
      !table.classList.contains("unlock")
    ) {
      countdown(table.id);
    }
  });
};

// clock
setInterval(() => {
  const clock = document.getElementById("clock");
  clock.innerHTML = currentTime();
}, 1000);
