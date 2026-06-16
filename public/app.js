// ══════════════════════════════════════
//  Firebase Config
// ══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsjwUzFyckvbpzURRogIJaYPa6pZsc4MM",
  authDomain: "janahi-honey.firebaseapp.com",
  projectId: "janahi-honey",
  storageBucket: "janahi-honey.firebasestorage.app",
  messagingSenderId: "331504346526",
  appId: "1:331504346526:web:781e3aa252a02b6b93a28f"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const whatsappNumber = "97339186814";
const container = document.getElementById("productsContainer");

let cart = JSON.parse(localStorage.getItem("cart")) || [];

let customerData = JSON.parse(localStorage.getItem("customerData")) || {
  notes: "",
  area: "",
  block: "",
  road: "",
  houseDetails: "",
  latitude: "",
  longitude: "",
  mapsLink: "",
  fullAddress: ""
};

window._products = {};

// ══════════════════════════════════════
//  أدوات حماية وتنظيف
// ══════════════════════════════════════

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function(ch) {
    return ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[ch];
  });
}

function escapeAttr(value) {
  return String(value ?? "").replace(/[&<>"]/g, function(ch) {
    return ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    })[ch];
  });
}

function escapeJs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function safeVideoUrl(url) {
  const raw = String(url ?? "").trim();

  if (!raw) return "#";

  try {
    const parsed = new URL(raw, window.location.href);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch (e) {}

  return "#";
}

function safeLink(url) {
  const raw = String(url ?? "").trim();

  if (!raw) return "";

  if (/^(https?:)?\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("images/") || raw.startsWith("/") || raw.startsWith("uploads/")) {
    return raw;
  }

  return raw;
}

function productImageSrc(product) {
  const raw = String(product.imageUrl || product.image || "").trim();

  if (!raw) return "";

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) {
    return raw;
  }

  if (raw.startsWith("/") || raw.startsWith("images/") || raw.startsWith("uploads/")) {
    return raw;
  }

  return "images/" + raw;
}

function reviewImageSrc(review) {
  const raw = String(review.imageUrl || review.image || "").trim();

  if (!raw) return "";

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) {
    return raw;
  }

  if (raw.startsWith("/") || raw.startsWith("images/") || raw.startsWith("uploads/")) {
    return raw;
  }

  return "images/" + raw;
}

function getCertificateUrl(product) {
  return safeLink(product.certificateUrl || product.certificate || "");
}

function parseVideosValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {}
  }

  return [];
}

function getProductVideos(product) {
  const fromVideos = parseVideosValue(product.videos);

  if (fromVideos.length > 0) {
    return fromVideos.filter(function(v) {
      return v && String(v.title || "").trim() && String(v.url || "").trim();
    });
  }

  const fromInstagram = parseVideosValue(product.instagram);

  if (fromInstagram.length > 0) {
    return fromInstagram.filter(function(v) {
      return v && String(v.title || "").trim() && String(v.url || "").trim();
    });
  }

  return [];
}

// ══════════════════════════════════════
//  السلة
// ══════════════════════════════════════

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateAllBadges();
}

function updateAllBadges() {
  const total = cart.reduce(function(sum, item) {
    return sum + (item.qty || 1);
  }, 0);

  document.querySelectorAll("#cartBadge").forEach(function(badge) {
    if (total > 0) {
      badge.textContent = total;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  });
}

function saveCustomerData() {
  localStorage.setItem("customerData", JSON.stringify(customerData));
}

function changeQty(index, delta) {
  if (!cart[index]) return;

  cart[index].qty = (cart[index].qty || 1) + delta;

  if (cart[index].qty < 1) {
    cart[index].qty = 1;
  }

  saveCart();
  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");

  if (!cartItems || !cartTotal) return;

  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <span style="font-size:2.5rem">🛒</span>
        <p style="color:#7A5535;margin:10px 0 16px;font-size:16px">السلة فارغة</p>
        <a href="products.html" class="btn-gold primary-btn" style="font-size:14px;padding:12px 28px">
          تصفح المنتجات
        </a>
      </div>
    `;

    cartTotal.textContent = "0";
    return;
  }

  let total = 0;

  cart.forEach(function(item, index) {
    const qty = item.qty || 1;
    const itemTotal = Number(item.price) * qty;

    total += itemTotal;

    cartItems.innerHTML += `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${escapeHtml(item.name)}</h4>
          <p>الحجم: ${escapeHtml(item.sizeLabel)}</p>
          <p class="ci-price">
            ${item.price} د.ب × <span>${qty}</span> =
            <strong>${itemTotal.toFixed(3)} د.ب</strong>
          </p>
        </div>

        <div class="cart-item-actions">
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
            <span class="qty-num">${qty}</span>
            <button class="qty-btn" onclick="changeQty(${index}, -1)">−</button>
          </div>

          <button onclick="removeFromCart(${index})" class="delete-btn">حذف</button>
        </div>
      </div>
    `;
  });

  cartTotal.textContent = total.toFixed(3);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
}

function loadCustomerDataIntoForm() {
  const notes = document.getElementById("customerNotes");
  const address = document.getElementById("fullAddress");

  if (notes) {
    notes.value = customerData.notes || "";

    notes.addEventListener("input", function() {
      customerData.notes = notes.value;
      saveCustomerData();
    });
  }

  if (address) {
    address.value = customerData.fullAddress || "";

    address.addEventListener("input", function() {
      customerData.fullAddress = address.value;
      saveCustomerData();
    });
  }
}

// ══════════════════════════════════════
//  الفيديوهات
// ══════════════════════════════════════

function renderVideosAction(product) {
  const videos = getProductVideos(product);
  const id = escapeJs(product.id);

  if (videos.length > 0) {
    return `
      <div class="video-btn-wrap">
        <button type="button" class="video-btn" onclick="toggleVideos('${id}', this)">
          🎬 مشاهدة الفيديو (${videos.length})
        </button>

        <div class="videos-dropdown" id="vd-${escapeAttr(product.id)}" style="display:none">
          ${videos.map(function(v, i) {
            const title = escapeHtml(v.title);
            const url = safeVideoUrl(v.url);
            const disabledClass = url === "#" ? " disabled-link" : "";

            return `
              <a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="video-dropdown-item${disabledClass}">
                ${i + 1}. ${title}
              </a>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  return `<span class="video-btn disabled-btn">🎬 لا يوجد فيديو</span>`;
}

function toggleVideos(productId, btn) {
  const dropdown = document.getElementById("vd-" + productId);

  if (!dropdown) return;

  const isOpen = dropdown.style.display !== "none";

  document.querySelectorAll(".videos-dropdown").forEach(function(d) {
    d.style.display = "none";
  });

  document.querySelectorAll(".video-btn").forEach(function(b) {
    b.classList.remove("active");
  });

  if (!isOpen) {
    dropdown.style.display = "flex";
    btn.classList.add("active");
  }
}

document.addEventListener("click", function(e) {
  if (!e.target.closest(".video-btn-wrap")) {
    document.querySelectorAll(".videos-dropdown").forEach(function(d) {
      d.style.display = "none";
    });

    document.querySelectorAll(".video-btn").forEach(function(b) {
      b.classList.remove("active");
    });
  }
});

// ══════════════════════════════════════
//  الوصف
// ══════════════════════════════════════

function toggleDesc(id) {
  const short = document.getElementById("desc-" + id);
  const full  = document.getElementById("full-" + id);
  const btn   = document.getElementById("toggle-" + id);

  if (!short || !full || !btn) return;

  const isHidden = full.style.display === "none";

  short.style.display = isHidden ? "none" : "block";
  full.style.display  = isHidden ? "block" : "none";
  btn.textContent     = isHidden ? "عرض أقل" : "المزيد من التفاصيل";
}

// ══════════════════════════════════════
//  الطلب عبر واتساب
// ══════════════════════════════════════

function sendOrderToWhatsApp() {
  if (cart.length === 0) {
    alert("السلة فارغة");
    return;
  }

  let total = 0;
  let orderLines = "";

  cart.forEach(function(item, i) {
    const qty = item.qty || 1;
    const itemTotal = Number(item.price) * qty;

    total += itemTotal;

    orderLines +=
      (i + 1) + "- " + item.name + "\n" +
      "الحجم: " + item.sizeLabel + "\n" +
      "الكمية: " + qty + "\n" +
      "السعر: " + itemTotal.toFixed(3) + " د.ب\n\n";
  });

  const address = customerData.fullAddress || "غير محدد";

 const message =
  "السلام عليكم، أريد تنفيذ الطلب التالي:\n\n" +
  orderLines +
  "المجموع الكلي: " + total.toFixed(3) + " د.ب\n" +
  "( غير شامل تكلفة التوصيل — التوصيل من 1.5 د.ب إلى 2 د.ب )\n\n" +
  "معلومات التوصيل:\n" +
  "العنوان: " + address;
  window.open("https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(message), "_blank");
}

function setupSendOrderButton() {
  const btn = document.getElementById("sendOrderBtn");

  if (btn) {
    btn.addEventListener("click", sendOrderToWhatsApp);
  }
}

// ══════════════════════════════════════
//  المنتجات
// ══════════════════════════════════════

function changeProductQty(productId, delta) {
  const input = document.getElementById("qty-" + productId);

  if (!input) return;

  let val = parseInt(input.value) || 1;

  val += delta;

  if (val < 1) {
    val = 1;
  }

  input.value = val;
}

async function loadProducts() {
  if (!container) return;

  container.innerHTML = '<p style="color:#7A5535;padding:20px;">جاري تحميل المنتجات...</p>';

  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      container.innerHTML = '<p style="color:#7A5535;padding:20px;">لا توجد منتجات حالياً</p>';
      return;
    }

    container.innerHTML = "";

    snapshot.forEach(function(docSnap) {
      const product = {
        id: docSnap.id,
        ...docSnap.data()
      };

      window._products[product.id] = product;

      const id = escapeJs(product.id);
      const img = productImageSrc(product);
      const cert = getCertificateUrl(product);
      const description = String(product.description || "");

      let statusText = "";
      let actionButtons = "";
      let cardClass = "product-card";

      if (product.status === "sold_out") {
        statusText = '<p class="sold-out">نفذت الكمية</p>';
        cardClass += " sold";
      } else {
        actionButtons = `
          <div class="size-qty-row">
            <select id="size-${escapeAttr(product.id)}" class="size-select">
              <option value="half_kilo">نصف كيلو — ${escapeHtml(product.price_small)} د.ب</option>
              <option value="one_kilo">كيلو — ${escapeHtml(product.price_medium)} د.ب</option>
            </select>

            <div class="qty-control">
              <button class="qty-btn" onclick="changeProductQty('${id}', 1)">+</button>
              <input type="number" id="qty-${escapeAttr(product.id)}" value="1" min="1" class="qty-input" readonly />
              <button class="qty-btn" onclick="changeProductQty('${id}', -1)">−</button>
            </div>
          </div>

          <button class="cart-btn" onclick="addToCartWithQty('${id}', this)">أضف للسلة</button>
        `;
      }

      const certBtn = cert
        ? `<a href="${escapeAttr(cert)}" target="_blank" rel="noopener" class="certificate-btn">شهادة الفحص</a>`
        : `<span class="certificate-btn disabled-btn">شهادة الفحص</span>`;

      container.innerHTML += `
        <div class="${cardClass}">
          <div class="product-image-wrap">
            <img src="${escapeAttr(img)}" alt="${escapeHtml(product.name)}" class="product-image"
              onerror="this.style.background='linear-gradient(135deg,#C8860A,#F0B429)';this.removeAttribute('src')">
          </div>

          <div class="product-body">
            <h3>${escapeHtml(product.name)}</h3>

            <p class="desc-short" id="desc-${escapeAttr(product.id)}">
              ${escapeHtml(description.substring(0, 60))}${description.length > 60 ? "..." : ""}
            </p>

            <p class="desc-full" id="full-${escapeAttr(product.id)}" style="display:none">
              ${escapeHtml(description)}
            </p>

            <span class="toggle-btn" id="toggle-${escapeAttr(product.id)}" onclick="toggleDesc('${id}')">
              المزيد من التفاصيل
            </span>

            <div class="extra-actions">
              ${renderVideosAction(product)}
              ${certBtn}
            </div>

            <div class="prices-box">
              <p><strong>نصف كيلو</strong>${escapeHtml(product.price_small)} د.ب</p>
              <p><strong>كيلو</strong>${escapeHtml(product.price_medium)} د.ب</p>
            </div>

            ${statusText}
            ${actionButtons}
          </div>
        </div>
      `;
    });

    renderCart();
    updateAllBadges();
  } catch (error) {
    console.error("Error loading products:", error);
    container.innerHTML = '<p style="color:#8B1A1A;padding:20px;">تعذر تحميل المنتجات من Firestore</p>';
  }
}

function addToCartWithQty(productId, btn) {
  const product = window._products[productId];

  if (!product) return;

  const sizeSelect = document.getElementById("size-" + product.id);
  const qtyInput = document.getElementById("qty-" + product.id);

  if (!sizeSelect || !qtyInput) return;

  const selectedSize = sizeSelect.value;
  const qty = parseInt(qtyInput.value) || 1;

  let price = 0;
  let sizeLabel = "";

  if (selectedSize === "half_kilo") {
    price = Number(product.price_small);
    sizeLabel = "نصف كيلو";
  } else if (selectedSize === "one_kilo") {
    price = Number(product.price_medium);
    sizeLabel = "كيلو";
  }

  const existing = cart.findIndex(function(i) {
    return i.id === product.id && i.size === selectedSize;
  });

  if (existing >= 0) {
    cart[existing].qty = (cart[existing].qty || 1) + qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      size: selectedSize,
      sizeLabel: sizeLabel,
      price: price,
      qty: qty
    });
  }

  saveCart();

  const orig = btn.textContent;

  btn.textContent = "✓ أضيف!";
  btn.style.background = "linear-gradient(135deg,#1a7a2e,#25a83e)";
  btn.style.color = "#fff";

  setTimeout(function() {
    btn.textContent = orig;
    btn.style.background = "";
    btn.style.color = "";
  }, 1500);

  qtyInput.value = 1;

  renderCart();
}

// ══════════════════════════════════════
//  تجارب الزبائن
// ══════════════════════════════════════

async function loadCustomerReviews() {
  const track = document.getElementById("reviewsTrack");

  if (!track) return;

  track.innerHTML = '<div class="reviews-loading">جاري التحميل...</div>';

  try {
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      track.innerHTML = '<p style="color:#7A5535;padding:20px;font-size:14px;">لا توجد آراء بعد</p>';
      return;
    }

    let html = "";

    snapshot.forEach(function(docSnap) {
      const review = {
        id: docSnap.id,
        ...docSnap.data()
      };

      const img = reviewImageSrc(review);

      html += `
        <div class="review-slide">
          <img src="${escapeAttr(img)}" alt="رأي عميل"
            onerror="this.closest('.review-slide').style.display='none'" />
        </div>
      `;
    });

    track.innerHTML = html;
  } catch (error) {
    console.error("Error loading reviews:", error);
    track.innerHTML = '<p style="color:#8B1A1A;padding:20px;font-size:14px;">تعذر تحميل آراء العملاء حالياً</p>';
  }
}

// ══════════════════════════════════════
//  ربط الدوال بالـ HTML
// ══════════════════════════════════════

window.changeQty = changeQty;
window.removeFromCart = removeFromCart;
window.toggleVideos = toggleVideos;
window.toggleDesc = toggleDesc;
window.changeProductQty = changeProductQty;
window.addToCartWithQty = addToCartWithQty;

// ══════════════════════════════════════
//  تشغيل الصفحة
// ══════════════════════════════════════

loadProducts();
loadCustomerReviews();

renderCart();
loadCustomerDataIntoForm();
setupSendOrderButton();
updateAllBadges();