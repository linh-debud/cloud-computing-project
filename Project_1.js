var baseUrl = "http://localhost:8082";
var workspace = "hethongdialy";
var layerName = "gadm41_vnm_0_1";
var layerName2 = "gadm41_vnm_1_1";

var styleDefault = "Style_adm_0_1";
var styleDefault2 = "Style_adm_1_1  ";

const imgLegend = (ws, sn) => {
  return `${baseUrl}/geoserver/${ws}/wms?service=WMS&version=1.1.0&request=GetLegendGraphic&layer=${ws}:${sn}&format=image/png`;
};

var layerOSM = new ol.layer.Tile({
  source: new ol.source.OSM(),
});

var layerProvince = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    ratio: 1,
    url: `${baseUrl}/geoserver/${workspace}/wms`,
    params: {
      LAYERS: `${workspace}:${layerName}`,
      STYLES: styleDefault,
    },
  }),
  opacity: 0.5,
});

var layerPort = new ol.layer.Image({
  source: new ol.source.ImageWMS({
    ratio: 1,
    url: `${baseUrl}/geoserver/${workspace}/wms`,
    params: {
      LAYERS: `${workspace}:${layerName2}`,
      STYLES: styleDefault2,
    },
  }),
  opacity: 0.5,
});

var vietnamCenter = ol.proj.fromLonLat([105.695835, 16.762622]);

var map = new ol.Map({
  target: "map",
  layers: [layerOSM, layerProvince, layerPort],
  view: new ol.View({
    center: vietnamCenter,
    zoom: 6,
  }),
});

// Bật/tắt lớp tỉnh
$("#switchProvince").on("change", function () {
  const onORoff = $(this).is(":checked");
  layerProvince.setVisible(onORoff);
});

// Bật/tắt lớp cảng
$("#switchPort").on("change", function () {
  const onORoff = $(this).is(":checked");
  layerPort.setVisible(onORoff);
});

// Sự kiện click vào bản đồ để lấy thông tin
map.on("singleclick", async function (evt) {
  var layer = $("#switchPort").is(":checked") ? layerPort : layerProvince;
  var view = map.getView();
  var viewResolution = view.getResolution();
  var source = layer.getSource();
  var url = source.getGetFeatureInfoUrl(
    evt.coordinate,
    viewResolution,
    view.getProjection(),
    { INFO_FORMAT: "application/json", FEATURE_COUNT: 50 }
  );

  // Lấy tọa độ (kinh độ, vĩ độ) từ sự kiện click
  const [longitude, latitude] = ol.proj.toLonLat(evt.coordinate);

  const weatherData = await getWeatherData(latitude, longitude); // Gọi API lấy dữ liệu thời tiết

  document.querySelector("#description_value").innerText = weatherData.description;
  document.querySelector("#temp_value").innerText = `${weatherData.temp}°C`;
  document.querySelector("#feels_like_value").innerText = `${weatherData.feels_like}°C`;
  document.querySelector("#humidity_value").innerText = `${weatherData.humidity}%`;
  document.querySelector("#wind_speed_value").innerText = `${weatherData.wind_speed} m/s`;

  window.listInfor = [];
  if (url) {
    await $.ajax({
      type: "GET", 
      url: url,
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      success: function (resp) {
        if (resp && resp.features.length > 0) {
          for (const item of resp.features) {
            window.listInfor.push(item.properties);
          }
          var html = `<table class="table">
                            <thead>
                                <tr>
                                    <th scope="col">No.</th>
                                    <th scope="col">Province Name</th>
                                    <th scope="col">Display Time</th>
                                    <th scope="col">Province Length</th>
                                    <th scope="col">Province Area</th>
                                </tr>
                            </thead>
                            <tbody>`;
          for (let index = 0; index < window.listInfor.length; index++) {
            const infor = window.listInfor[index];
            const currentTime = new Date();
            html += `<tr>
                            <th scope="row">${index + 1}</th>
                            <td>${infor.varname_1}</td>
                            <td>${currentTime.toLocaleString()}</td>
                            <td>${infor.shape_leng}</td>
                            <td>${infor.shape_area}</td>
                        </tr>`;
          }
          html += `</tbody></table>`;

          $(".modal-body").html(html);
          $("#modalDetail").show();
        }
      },
    });
  }
  
});
$("#closeModal").on("click", function () {
  $("#modalDetail").hide();
});

async function getWeatherData(lat, lon) {
  const key = "101cdfc13f4ff88fb178a7c161d5cfc1";
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}`;
  const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;

  try {
    // Lấy dữ liệu thời tiết hiện tại
    const response = await fetch(url);
    const data = await response.json();

    const weatherInfo = {
      temp: parseFloat(data.main.temp - 273.15).toFixed(1), // Chuyển đổi Kelvin sang Celsius
      feels_like: parseFloat(data.main.feels_like - 273.15).toFixed(1),
      humidity: data.main.humidity,
      wind_speed: data.wind.speed.toFixed(1),
      description: data.weather[0].description,
    };

    // Lấy dữ liệu dự báo thời tiết 5 ngày
    const responseForecast = await fetch(urlForecast);
    const dataForecast = await responseForecast.json();

    // Lọc dự báo mỗi ngày một lần
    const forecasts = dataForecast.list.filter((_, index) => index % 8 === 0);
    const forecastData = forecasts.map((forecast) => ({
      date: new Date(forecast.dt_txt).toLocaleDateString(),
      temp: `${forecast.main.temp.toFixed(1)}°C`,
      humidity: `${forecast.main.humidity}%`,
      description: forecast.weather[0].description,
    }));

    // Hiển thị bảng dự báo thời tiết
    const forecastBody = document.querySelector("#forecast_body");
    forecastBody.innerHTML = ""; // Xóa nội dung cũ

    forecastData.forEach((forecast) => {
      const row = `<tr>
        <td>${forecast.date}</td>
        <td>${forecast.temp}</td>
        <td>${forecast.humidity}</td>
        <td>${forecast.description}</td>
      </tr>`;
      forecastBody.innerHTML += row;
    });

    return weatherInfo;
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu thời tiết:", error);

    // Trả về dữ liệu rỗng trong trường hợp lỗi
    return {
      temp: "N/A",
      feels_like: "N/A",
      humidity: "N/A",
      wind_speed: "N/A",
      description: "Không lấy được dữ liệu",
    };
  }
}

// Biến trạng thái hiển thị
let isForecastVisible = false;

// Sự kiện click để ẩn/hiện bảng dự báo
document.querySelector("#toggleForecast").addEventListener("click", function () {
  const forecastContainer = document.querySelector("#forecastContainer");
  
  // Thay đổi trạng thái hiển thị
  isForecastVisible = !isForecastVisible;

  if (isForecastVisible) {
    forecastContainer.style.display = "block"; // Hiển thị bảng
    // icon.classList.remove("fa-cloud-sun"); // Xóa icon hiện tại
    // icon.classList.add("fa-cloud-showers-heavy"); // Thêm icon mới
  } else {
    forecastContainer.style.display = "none"; // Ẩn bảng
    // icon.classList.remove("fa-cloud-showers-heavy"); // Xóa icon hiện tại
    // icon.classList.add("fa-cloud-sun"); // Thêm icon mới
  }
});

// Hiển thị modal thời tiết
document.querySelector(".modal_weather").style.display = "block";
document.querySelector(".close").addEventListener("click", function () {
  document.querySelector(".modal_weather").style.display = "none";
});