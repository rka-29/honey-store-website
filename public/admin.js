import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ══════════════════════════════════════
//  Firebase Config
// ══════════════════════════════════════
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

// ══════════════════════════════════════
//  Cloudinary Config
// ══════════════════════════════════════
const CLOUDINARY_CLOUD_NAME = "dad1dl1sw";
const CLOUDINARY_UPLOAD_PRESET = "dad1dl1sw";

const adminContainer = document.getElementById("adminProductsContainer");
const addProductForm = document.getElementById("addProductForm");

// ══════════════════════════════════════
//  أدوات مساعدة
// ══════════════════════════════════════
let productVideos = [];
let selectedProductImageFile = null;
let selectedCertFile = null;

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

function productImageSrc(product) {
  const raw = String(product.imageUrl || product.image || "").trim();

  if (!raw) return "";

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) {
    return raw;
  }

  if (raw.startsWith("/") || raw.startsWith("images/") || raw.startsWith("uploads/")) {
    return raw;
  }

  // دعم مؤقت للصور القديمة داخل public/images
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

  // دعم مؤقت لصور الآراء القديمة داخل public/images
  return "images/" + raw;
}

function getCertificateSrc(product) {
  const raw = String(product.certificateUrl || product.certificate || "").trim();

  if (!raw) return "";

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) {
    return raw;
  }

  if (raw.startsWith("/") || raw.startsWith("images/") || raw.startsWith("uploads/")) {
    return raw;
  }

  return "images/" + raw;
}

function getStoredVideos(product) {
  if (Array.isArray(product.videos)) {
    return product.videos.filter(function(v) {
      return v && String(v.title || "").trim() && String(v.url || "").trim();
    });
  }

  if (typeof product.videos === "string") {
    try {
      const parsed = JSON.parse(product.videos);

      if (Array.isArray(parsed)) {
        return parsed.filter(function(v) {
          return v && String(v.title || "").trim() && String(v.url || "").trim();
        });
      }
    } catch (e) {}
  }

  return [];
}

function timestampValue(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function numericIdValue(id) {
  const num = Number(id);
  return Number.isFinite(num) ? num : 0;
}

function sortNewestFirst(items) {
  return items.sort(function(a, b) {
    const bTime = timestampValue(b.createdAt || b.updatedAt || b.date);
    const aTime = timestampValue(a.createdAt || a.updatedAt || a.date);

    if (bTime !== aTime) return bTime - aTime;

    return numericIdValue(b.id) - numericIdValue(a.id);
  });
}

function setUploadProgress(progressDiv, progressBar, progressText, percent, text) {
  if (progressDiv) progressDiv.style.display = "flex";
  if (progressBar) progressBar.style.width = percent + "%";
  if (progressText && text) progressText.textContent = text;
}

async function uploadToCloudinary(file, folderName, progressDiv, progressBar, progressText) {
  if (!file) return null;

  setUploadProgress(progressDiv, progressBar, progressText, 20, "جاري تجهيز الصورة...");

  const url = "https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/image/upload";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  if (folderName) {
    formData.append("folder", folderName);
  }

  setUploadProgress(progressDiv, progressBar, progressText, 55, "جاري الرفع إلى Cloudinary...");

  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    console.error("Cloudinary upload error:", data);
    throw new Error(data.error?.message || "فشل رفع الصورة إلى Cloudinary");
  }

  setUploadProgress(progressDiv, progressBar, progressText, 100, "تم الرفع بنجاح");

  return {
    url: data.secure_url,
    publicId: data.public_id || "",
    originalName: file.name
  };
}

// ══════════════════════════════════════
//  إدارة الفيديوهات
// ══════════════════════════════════════
function addVideoField() {
  const title = document.getElementById("videoTitle").value.trim();
  const url = document.getElementById("videoUrl").value.trim();

  if (!title || !url) {
    alert("أدخل العنوان والرابط");
    return;
  }

  productVideos.push({ title, url });

  document.getElementById("videoTitle").value = "";
  document.getElementById("videoUrl").value = "";

  renderVideosList();
}

function removeVideo(idx) {
  productVideos.splice(idx, 1);
  renderVideosList();
}

function renderVideosList() {
  const list = document.getElementById("videosList");

  if (!list) return;

  list.innerHTML = productVideos.map(function(v, i) {
    return `
      <div class="video-item">
        <span class="video-item-title">${escapeHtml(v.title)}</span>
        <span class="video-item-url">${escapeHtml(v.url)}</span>
        <button type="button" class="video-item-del" onclick="removeVideo(${i})">✕</button>
      </div>
    `;
  }).join("");
}

// ══════════════════════════════════════
//  صورة المنتج — Cloudinary
// ══════════════════════════════════════
const imageHidden = document.getElementById("image");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");
const uploadPreview = document.getElementById("uploadPreview");
const previewImg = document.getElementById("previewImg");
const previewName = document.getElementById("previewName");
const imageFileInput = document.getElementById("imageFile");

const uploadProgress = document.getElementById("uploadProgress");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadProgressText = document.getElementById("uploadProgressText");

if (imageFileInput) {
  imageFileInput.addEventListener("change", function() {
    const file = imageFileInput.files[0];

    if (!file) return;

    selectedProductImageFile = file;

    const reader = new FileReader();

    reader.onload = function(e) {
      previewImg.src = e.target.result;
      previewName.textContent = file.name;
      uploadPlaceholder.style.display = "none";
      uploadPreview.style.display = "flex";

      if (uploadProgress) uploadProgress.style.display = "none";

      // الرفع الفعلي يتم عند الضغط على إضافة المنتج
      imageHidden.value = file.name;
    };

    reader.readAsDataURL(file);
  });
}

function removeImage() {
  selectedProductImageFile = null;

  if (imageHidden) imageHidden.value = "";
  if (imageFileInput) imageFileInput.value = "";
  if (previewImg) previewImg.src = "";
  if (previewName) previewName.textContent = "";
  if (uploadPreview) uploadPreview.style.display = "none";
  if (uploadPlaceholder) uploadPlaceholder.style.display = "flex";
  if (uploadProgress) uploadProgress.style.display = "none";
  if (uploadProgressBar) uploadProgressBar.style.width = "0%";
}

// ══════════════════════════════════════
//  شهادة الفحص — Cloudinary
// ══════════════════════════════════════
const certHidden = document.getElementById("certificate");
const certPlaceholder = document.getElementById("certPlaceholder");
const certPreview = document.getElementById("certPreview");
const certPreviewImg = document.getElementById("certPreviewImg");
const certPreviewName = document.getElementById("certPreviewName");
const certFile = document.getElementById("certFile");

const certProgress = document.getElementById("certProgress");
const certProgressBar = document.getElementById("certProgressBar");
const certProgressText = document.getElementById("certProgressText");

if (certFile) {
  certFile.addEventListener("change", function() {
    const file = certFile.files[0];

    if (!file) return;

    selectedCertFile = file;

    const reader = new FileReader();

    reader.onload = function(e) {
      certPreviewImg.src = e.target.result;
      certPreviewName.textContent = file.name;
      certPlaceholder.style.display = "none";
      certPreview.style.display = "flex";

      if (certProgress) certProgress.style.display = "none";

      // الرفع الفعلي يتم عند الضغط على إضافة المنتج
      certHidden.value = file.name;
    };

    reader.readAsDataURL(file);
  });
}

function removeCert() {
  selectedCertFile = null;

  if (certHidden) certHidden.value = "";
  if (certFile) certFile.value = "";
  if (certPreviewImg) certPreviewImg.src = "";
  if (certPreviewName) certPreviewName.textContent = "";
  if (certPreview) certPreview.style.display = "none";
  if (certPlaceholder) certPlaceholder.style.display = "flex";
  if (certProgress) certProgress.style.display = "none";
  if (certProgressBar) certProgressBar.style.width = "0%";
}

// ══════════════════════════════════════
//  تحميل المنتجات
// ══════════════════════════════════════
async function loadProducts() {
  if (!adminContainer) return;

  adminContainer.innerHTML = '<p style="color:#7A5535;">جاري التحميل...</p>';

  try {
    const snapshot = await getDocs(collection(db, "products"));

    const products = snapshot.docs.map(function(d) {
      return {
        id: d.id,
        ...d.data()
      };
    });

    sortNewestFirst(products);

    if (!products.length) {
      adminContainer.innerHTML = '<p style="color:#7A5535;">لا توجد منتجات بعد</p>';
      return;
    }

    adminContainer.innerHTML = "";

    products.forEach(function(product) {
      const videos = getStoredVideos(product);
      const img = productImageSrc(product);
      const cert = getCertificateSrc(product);

      const certHtml = cert
        ? `<a href="${escapeAttr(cert)}" target="_blank" rel="noopener" class="certificate-btn" style="margin-top:8px;">شهادة الفحص</a>`
        : `<span class="certificate-btn disabled-btn" style="margin-top:8px;">لا توجد شهادة</span>`;

      adminContainer.innerHTML += `
        <div class="product-card">
          <div class="product-image-wrap">
            <img src="${escapeAttr(img)}" alt="${escapeHtml(product.name)}" class="product-image"
              onerror="this.style.background='linear-gradient(135deg,#C8860A,#F0B429)';this.removeAttribute('src')"/>
          </div>

          <div class="product-body">
            <h3>${escapeHtml(product.name)}</h3>

            <p style="font-size:12px;color:#7A5535;margin:4px 0;">
              نصف كيلو: ${escapeHtml(product.price_small)} د.ب | كيلو: ${escapeHtml(product.price_medium)} د.ب
            </p>

            <p style="font-size:12px;color:${product.status === "sold_out" ? "#8B1A1A" : "#1a7a2e"};font-weight:700;">
              ${product.status === "sold_out" ? "🔴 نفذت الكمية" : "🟢 متوفر"}
            </p>

            ${certHtml}

            <div class="admin-videos-section">
              <h5>🎬 الفيديوهات (${videos.length})</h5>

              ${videos.map(function(v, i) {
                return `
                  <div class="admin-video-tag">
                    <a href="${escapeAttr(v.url)}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a>
                    <button type="button" class="video-item-del" onclick="removeVideoFromProduct('${escapeAttr(product.id)}', ${i})">✕</button>
                  </div>
                `;
              }).join("")}

              <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
                <input type="text" id="vt-${escapeAttr(product.id)}" placeholder="عنوان الفيديو" class="field" style="flex:1;min-width:100px;font-size:12px;padding:7px 10px;"/>
                <input type="text" id="vu-${escapeAttr(product.id)}" placeholder="رابط الفيديو" class="field" style="flex:2;min-width:140px;font-size:12px;padding:7px 10px;"/>
                <button type="button" onclick="addVideoToProduct('${escapeAttr(product.id)}')" class="add-video-btn" style="font-size:12px;padding:7px 12px;">+ إضافة</button>
              </div>
            </div>

            <div class="admin-buttons">
              <button onclick="deleteProduct('${escapeAttr(product.id)}')" class="delete-btn">🗑 حذف</button>
              <button onclick="markAvailable('${escapeAttr(product.id)}')" class="available-btn">✓ متوفر</button>
            </div>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Error loading products:", err);
    adminContainer.innerHTML = '<p style="color:#8B1A1A;">تعذر تحميل المنتجات</p>';
  }
}

// ══════════════════════════════════════
//  إضافة منتج
// ══════════════════════════════════════
if (addProductForm) {
  addProductForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    if (!selectedProductImageFile) {
      alert("يرجى اختيار صورة للمنتج");
      return;
    }

    const submitBtn = addProductForm.querySelector(".admin-submit");
    const originalText = submitBtn.textContent;

    submitBtn.textContent = "جاري رفع الصور...";
    submitBtn.disabled = true;

    try {
      const uploadedImage = await uploadToCloudinary(
        selectedProductImageFile,
        "janahi-honey/products",
        uploadProgress,
        uploadProgressBar,
        uploadProgressText
      );

      let uploadedCert = null;

      if (selectedCertFile) {
        uploadedCert = await uploadToCloudinary(
          selectedCertFile,
          "janahi-honey/certificates",
          certProgress,
          certProgressBar,
          certProgressText
        );
      }

      submitBtn.textContent = "جاري حفظ المنتج...";

      const snapshot = await getDocs(collection(db, "products"));

      const ids = snapshot.docs.map(function(d) {
        return Number(d.id);
      }).filter(function(num) {
        return Number.isFinite(num);
      });

      const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

      await setDoc(doc(db, "products", String(newId)), {
        name: document.getElementById("name").value.trim(),
        description: document.getElementById("description").value.trim(),
        whatsapp:"",
        instagram: "",
        image: uploadedImage.url,
        imageUrl: uploadedImage.url,
        imagePublicId: uploadedImage.publicId,
        imageOriginalName: uploadedImage.originalName,
        status: document.getElementById("status").value,
        certificate: uploadedCert ? uploadedCert.url : null,
        certificateUrl: uploadedCert ? uploadedCert.url : null,
        certificatePublicId: uploadedCert ? uploadedCert.publicId : "",
        certificateOriginalName: uploadedCert ? uploadedCert.originalName : "",
        videos: productVideos,
        price_small: Number(document.getElementById("price_small").value || 0),
        price_medium: Number(document.getElementById("price_medium").value || 0),
        price_large: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      addProductForm.reset();
      removeImage();
      removeCert();
      productVideos = [];
      renderVideosList();

      submitBtn.textContent = "✓ تمت الإضافة!";
      submitBtn.style.background = "linear-gradient(135deg,#1a7a2e,#25a83e)";

      setTimeout(function() {
        submitBtn.textContent = originalText || "➕ إضافة المنتج";
        submitBtn.style.background = "";
        submitBtn.disabled = false;
      }, 1800);

      loadProducts();
    } catch (err) {
      console.error("Error adding product:", err);

      submitBtn.textContent = originalText || "➕ إضافة المنتج";
      submitBtn.disabled = false;

      alert("فشل إضافة المنتج: " + err.message);
    }
  });
}

// ══════════════════════════════════════
//  حذف منتج
// ══════════════════════════════════════
async function deleteProduct(id) {
  if (!confirm("هل تريد حذف هذا المنتج؟")) return;

  try {
    await deleteDoc(doc(db, "products", String(id)));
    loadProducts();
  } catch (err) {
    console.error("Error deleting product:", err);
    alert("فشل حذف المنتج");
  }
}

// ══════════════════════════════════════
//  تغيير حالة المنتج لمتوفر
// ══════════════════════════════════════
async function markAvailable(id) {
  try {
    await updateDoc(doc(db, "products", String(id)), {
      status: "available",
      updatedAt: serverTimestamp()
    });

    loadProducts();
  } catch (err) {
    console.error("Error updating product:", err);
    alert("فشل التحديث");
  }
}

// ══════════════════════════════════════
//  إضافة فيديو لمنتج موجود
// ══════════════════════════════════════
async function addVideoToProduct(productId) {
  const titleEl = document.getElementById("vt-" + productId);
  const urlEl = document.getElementById("vu-" + productId);

  const title = titleEl.value.trim();
  const url = urlEl.value.trim();

  if (!title || !url) {
    alert("أدخل العنوان والرابط");
    return;
  }

  try {
    const docRef = doc(db, "products", String(productId));

    const snapshot = await getDocs(collection(db, "products"));

    const productDoc = snapshot.docs.find(function(d) {
      return d.id === String(productId);
    });

    if (!productDoc) {
      alert("المنتج غير موجود");
      return;
    }

    const videos = getStoredVideos(productDoc.data());
    videos.push({ title, url });

    await updateDoc(docRef, {
      videos,
      updatedAt: serverTimestamp()
    });

    titleEl.value = "";
    urlEl.value = "";

    loadProducts();
  } catch (err) {
    console.error("Error adding video:", err);
    alert("فشل إضافة الفيديو");
  }
}

// ══════════════════════════════════════
//  حذف فيديو من منتج
// ══════════════════════════════════════
async function removeVideoFromProduct(productId, idx) {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    const productDoc = snapshot.docs.find(function(d) {
      return d.id === String(productId);
    });

    if (!productDoc) return;

    const videos = getStoredVideos(productDoc.data()).filter(function(_, i) {
      return i !== idx;
    });

    await updateDoc(doc(db, "products", String(productId)), {
      videos,
      updatedAt: serverTimestamp()
    });

    loadProducts();
  } catch (err) {
    console.error("Error removing video:", err);
    alert("فشل حذف الفيديو");
  }
}

// ══════════════════════════════════════
//  آراء العملاء
// ══════════════════════════════════════
async function loadReviews() {
  const grid = document.getElementById("reviewsGrid");

  if (!grid) return;

  grid.innerHTML = '<p style="color:#7A5535;font-size:14px;">جاري التحميل...</p>';

  try {
    const snapshot = await getDocs(collection(db, "reviews"));

    const reviews = snapshot.docs.map(function(d) {
      return {
        id: d.id,
        ...d.data()
      };
    });

    sortNewestFirst(reviews);

    if (!reviews.length) {
      grid.innerHTML = '<p style="color:#7A5535;font-size:14px;">لا توجد آراء بعد</p>';
      return;
    }

    grid.innerHTML = reviews.map(function(r) {
      const src = reviewImageSrc(r);

      return `
        <div class="review-admin-card">
          <img src="${escapeAttr(src)}" alt="رأي عميل" onerror="this.closest('.review-admin-card').style.display='none'"/>
          <button type="button" class="delete-btn review-del-btn" onclick="deleteReview('${escapeAttr(r.id)}')">🗑 حذف</button>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading reviews:", err);
    grid.innerHTML = '<p style="color:#8B1A1A;font-size:14px;">تعذر تحميل آراء العملاء</p>';
  }
}

async function deleteReview(id) {
  if (!confirm("هل تريد حذف رأي العميل؟")) return;

  try {
    await deleteDoc(doc(db, "reviews", String(id)));
    loadReviews();
  } catch (err) {
    console.error("Error deleting review:", err);
    alert("فشل حذف الرأي");
  }
}

// رفع صور آراء العملاء إلى Cloudinary
const reviewFileInput = document.getElementById("reviewFile");

if (reviewFileInput) {
  reviewFileInput.addEventListener("change", async function() {
    const files = Array.from(reviewFileInput.files || []);

    if (!files.length) return;

    const placeholder = document.getElementById("reviewPlaceholder");
    const uploadText = placeholder ? placeholder.querySelector(".upload-text") : null;

    if (uploadText) {
      uploadText.textContent = "جاري رفع الصور إلى Cloudinary...";
    }

    try {
      const snapshot = await getDocs(collection(db, "reviews"));

      const ids = snapshot.docs.map(function(d) {
        return Number(d.id);
      }).filter(function(num) {
        return Number.isFinite(num);
      });

      let maxId = ids.length > 0 ? Math.max(...ids) : 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (uploadText) {
          uploadText.textContent = "جاري رفع الصورة " + (i + 1) + " من " + files.length + "...";
        }

        const uploaded = await uploadToCloudinary(
          file,
          "janahi-honey/reviews",
          null,
          null,
          null
        );

        maxId++;

        await setDoc(doc(db, "reviews", String(maxId)), {
          image: uploaded.url,
          imageUrl: uploaded.url,
          imagePublicId: uploaded.publicId,
          imageOriginalName: uploaded.originalName,
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      alert("تم رفع وحفظ " + files.length + " صورة بنجاح");

      reviewFileInput.value = "";

      if (uploadText) {
        uploadText.textContent = "اضغط لرفع صور آراء العملاء";
      }

      loadReviews();
    } catch (err) {
      console.error("Error saving reviews:", err);

      alert("فشل حفظ الآراء: " + err.message);

      if (uploadText) {
        uploadText.textContent = "اضغط لرفع صور آراء العملاء";
      }
    }
  });
}

// ══════════════════════════════════════
//  إحصائيات الصفحة الرئيسية
// ══════════════════════════════════════
async function loadStats() {
  try {
    const docRef = doc(db, "settings", "stats");
    const docSnap = await getDoc(docRef);

    const statsInput = document.getElementById("statsText");

    if (statsInput && docSnap.exists()) {
      statsInput.value = docSnap.data().statsText || "";
    }
  } catch (err) {
    console.error("Error loading stats:", err);
  }
}

async function saveStats() {
  const statsInput = document.getElementById("statsText");

  if (!statsInput) return;

  const text = statsInput.value.trim();

  if (!text) {
    alert("أدخل النص");
    return;
  }

  try {
    await setDoc(doc(db, "settings", "stats"), {
      statsText: text,
      updatedAt: serverTimestamp()
    });

    const btn = document.getElementById("saveStatsBtn");

    if (btn) {
      btn.textContent = "✓ تم الحفظ!";
      btn.style.background = "linear-gradient(135deg,#1a7a2e,#25a83e)";

      setTimeout(function() {
        btn.textContent = "💾 حفظ";
        btn.style.background = "";
      }, 2000);
    }
  } catch (err) {
    console.error("Error saving stats:", err);
    alert("فشل الحفظ");
  }
}

// إضافة قسم الإحصائيات في الصفحة
function addStatsSection() {
  const main = document.querySelector(".admin-wrapper");

  if (!main) return;

  const section = document.createElement("div");

  section.innerHTML = `
    <div class="admin-sec-title" style="margin-top:50px;">📊 إحصائيات الصفحة الرئيسية</div>

    <div class="admin-form-card">
      <p style="font-size:13px;color:#7A5535;margin:0 0 14px;">
        هذا النص يظهر في الصفحة الرئيسية تحت قسم الجودة
      </p>

      <textarea id="statsText" class="field" rows="3" style="width:100%;margin-bottom:14px;"
        placeholder="مثال: من 2017/1/22م إلى 2025/10/11م — فحصنا 460 عينة عسل بتكلفة 18,622 دينار بحريني"></textarea>

      <button id="saveStatsBtn" onclick="saveStats()" class="admin-submit" style="grid-column:unset;width:auto;padding:12px 32px;">
        💾 حفظ
      </button>
    </div>
  `;

  main.appendChild(section);
  loadStats();
}

// ══════════════════════════════════════
//  تصدير الدوال للاستخدام في HTML
// ══════════════════════════════════════
window.addVideoField = addVideoField;
window.removeVideo = removeVideo;
window.deleteProduct = deleteProduct;
window.markAvailable = markAvailable;
window.addVideoToProduct = addVideoToProduct;
window.removeVideoFromProduct = removeVideoFromProduct;
window.deleteReview = deleteReview;
window.removeImage = removeImage;
window.removeCert = removeCert;
window.saveStats = saveStats;

// ══════════════════════════════════════
//  تشغيل الصفحة
// ══════════════════════════════════════
loadProducts();
loadReviews();
addStatsSection();