"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

export default function Page() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dietType, setDietType] = useState("all");
  const [data, setData] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedNutrition, setSelectedNutrition] = useState<any[]>([]);
  const [randomRecipes, setRandomRecipes] = useState<any[]>([]);
  const [showNutrition, setShowNutrition] = useState<boolean>(false);
  const [functionExecMs, setFunctionExecMs] = useState<number | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);

  // ECharts wrapper (client-only)
  // dynamic import but cast to any so we can call with option prop without strict typing issues
  const ReactECharts: any = dynamic(() => import("echarts-for-react"), { ssr: false }) as any;

  // Helper: parse numeric value from fields like "Protein(g)"
  function parseNumeric(val: any): number | null {
    if (val == null) return null;
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = Number(String(val).replace(/[^0-9.\-]/g, ""));
      return isNaN(n) ? null : n;
    }
    return null;
  }

  // Build echarts options from available data (use searchResults if filtered)
  function buildBarOption() {
    const src = data;
    const groups: Record<string, number[]> = {};
    src.forEach((item) => {
      const diet = (item.Diet_type || "Unknown").toString();
      const p = parseNumeric(item["Protein(g)"]);
      if (!groups[diet]) groups[diet] = [];
      if (p != null) groups[diet].push(p);
    });
    const categories = Object.keys(groups);
    const averages = categories.map((c) => {
      const arr = groups[c];
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((s, v) => s + v, 0) / arr.length;
    });
    return {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: categories },
      yAxis: { type: "value", name: "Protein (g)" },
      series: [{ type: "bar", data: averages }],
    };
  }

  function buildScatterOption() {
    const src = data;
    const points: Array<number[]> = [];
    src.forEach((item) => {
      const p = parseNumeric(item["Protein(g)"]);
      const c = parseNumeric(item["Carbs(g)"]);
      if (p != null && c != null) points.push([p, c]);
    });
    return {
      tooltip: { trigger: 'item' },
      xAxis: { name: 'Protein (g)', type: 'value' },
      yAxis: { name: 'Carbs (g)', type: 'value' },
      series: [{ type: 'scatter', data: points }],
    };
  }

  function buildHeatmapOption() {
    const src = data;
    const nutrientKeys = ["Protein(g)", "Carbs(g)", "Fat(g)"];
    const diets = Array.from(new Set(src.map((s) => (s.Diet_type || 'Unknown').toString())));
    const dataArr: Array<[number, number, number]> = [];
    nutrientKeys.forEach((nk, yi) => {
      diets.forEach((d, xi) => {
        const items = src.filter((s) => (s.Diet_type || 'Unknown').toString() === d);
        const vals = items.map((it) => parseNumeric(it[nk]) ?? parseNumeric(it[nk.replace('(g)','')]));
        const nums = vals.filter((v) => v != null) as number[];
        const avg = nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : 0;
        dataArr.push([xi, yi, Number(avg.toFixed(2))]);
      });
    });
    return {
      tooltip: { position: 'top' },
      xAxis: { type: 'category', data: diets },
      yAxis: { type: 'category', data: nutrientKeys },
      visualMap: { min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', top: 'top' },
      series: [{ name: 'Avg', type: 'heatmap', data: dataArr, label: { show: false } }],
    };
  }

  function buildPieOption() {
    const src = data;
    const counts: Record<string, number> = {};
    src.forEach((item) => {
      const d = (item.Diet_type || 'Unknown').toString();
      counts[d] = (counts[d] || 0) + 1;
    });
    const dataArr = Object.entries(counts).map(([name, value]) => ({ name, value }));
    return {
      tooltip: { trigger: 'item' },
      series: [{ type: 'pie', radius: '60%', data: dataArr, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } } }],
    };
  }

  function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function getNutritionalInsights() {
    const selectedObjects = selectedItems
      .map((i) => searchResults[i])
      .filter((it) => it !== undefined && it !== null);

    // Explicitly extract these keys from the dataset
    const nutrientKeys = ["Protein(g)", "Carbs(g)", "Fat(g)"];

    function findProp(obj: Record<string, any>, key: string) {
      const lower = key.toLowerCase();
      const found = Object.keys(obj || {}).find((k) => k.toLowerCase() === lower);
      return found;
    }

    const extracted = selectedObjects.map((obj) => {
      const nutrients: Record<string, number | string> = {};
      nutrientKeys.forEach((k) => {
        const prop = findProp(obj, k);
        if (prop) {
          const raw = obj[prop];
          let parsed: number | string = "N/A";
          if (typeof raw === "number") parsed = raw;
          else if (typeof raw === "string") {
            const n = Number(raw.replace(/[^0-9.\-]/g, ""));
            parsed = isNaN(n) ? raw : n;
          }
          nutrients[k] = parsed;
        } else {
          nutrients[k] = "N/A";
        }
      });
      return { name: obj.Recipe_name || obj.name || "Unnamed", nutrients, raw: obj };
    });

    setSelectedNutrition(extracted);
  }

  function extractNutrients(obj: Record<string, any>) {
    const nutrientKeys = ["Protein(g)", "Carbs(g)", "Fat(g)"];
    function findProp(key: string) {
      const lower = key.toLowerCase();
      return Object.keys(obj || {}).find((k) => k.toLowerCase() === lower);
    }
    const nutrients: Record<string, number | string> = {};
    nutrientKeys.forEach((k) => {
      const prop = findProp(k);
      if (prop) {
        const raw = obj[prop];
        let parsed: number | string = "N/A";
        if (typeof raw === "number") parsed = raw;
        else if (typeof raw === "string") {
          const n = Number(raw.replace(/[^0-9.\-]/g, ""));
          parsed = isNaN(n) ? raw : n;
        }
        nutrients[k] = parsed;
      } else {
        nutrients[k] = "N/A";
      }
    });
    return nutrients;
  }

  function getRandomRecipes() {
    const source = searchResults.length > 0 ? searchResults : data;
    if (!source || source.length === 0) {
      setRandomRecipes([]);
      return;
    }
    // Fisher-Yates shuffle copy
    const arr = source.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const picked = arr.slice(0, Math.min(6, arr.length));
    const extracted = picked.map((obj) => ({
      name: obj.Recipe_name || obj.name || "Unnamed",
      nutrients: extractNutrients(obj),
      raw: obj,
    }));
    setRandomRecipes(extracted);
  }

  useEffect(() => {
    async function FetchDataset() {
      try {
        const start = performance.now();
        const response = await fetch("https://get-data-exaxb3e2dcddc6h8.canadacentral-01.azurewebsites.net/api/fetchdataset");
        const data = await response.json();
        const end = performance.now();
        const duration = end - start;
        console.log(data);
        setData(data);
        setFunctionExecMs(duration);
        setLastFetchTime(new Date().toISOString());
      } catch (error) {
        console.error("Error fetching dataset:", error);
      }
    }

    FetchDataset();
  }, []);

  useEffect(() => {
    // Recompute results whenever data, dietType or searchTerm change
    const q = (searchTerm || "").toLowerCase();
    const results = data.filter((item) => {
      const dietField = ((item && item.Diet_type) || "")
        .toString()
        .toLowerCase();
      const matchesDietType =
        dietType === "all" || dietField === dietType.toLowerCase();
      // Check any field for the search query
      const anyField = Object.values(item || {})
        .join(" ")
        .toLowerCase();
      const matchesSearchTerm = anyField.includes(q);
      return matchesDietType && matchesSearchTerm;
    });
    setSearchResults(results);
  }, [data, dietType, searchTerm]);

  // When the nutrition panel is visible, automatically recompute when selection changes
  useEffect(() => {
    if (showNutrition) {
      getNutritionalInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, showNutrition]);

  return (
    <div className="bg-gray-100 text-black py-15">
      {/* Header */}
      <div className="bg-blue-600 p-4 text-white flex justify-between fixed top-0 left-0 w-full">
        <h1 className="text-3xl font-semibold">Nutritional Insights</h1>
        <div className="flex gap-6 items-center">
          <div className="text-sm text-white">
            {functionExecMs !== null ? (
              <div>Function fetch time: {functionExecMs.toFixed(0)} ms</div>
            ) : (
              <div>Function fetch time: N/A</div>
            )}
            <div className="text-xs opacity-90">
              Last fetch: {lastFetchTime ? new Date(lastFetchTime).toLocaleString() : "never"}
            </div>
          </div>
          <button
            className="bg-white text-blue-600 px-4 py-2 rounded mr-2"
            onClick={() => window.location.reload()}
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Explore Nutritional Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 shadow-lg rounded-lg">
              <h3 className="font-semibold">Bar Chart</h3>
              <p className="text-sm text-gray-600">
                Average macronutrient content by diet type.
              </p>
              <div className="w-full h-48">
                <ReactECharts option={buildBarOption()} style={{ margin: '-10px' ,height: '130%', width: '100%' }} />
              </div>
            </div>

            <div className="bg-white p-4 shadow-lg rounded-lg">
              <h3 className="font-semibold">Scatter Plot</h3>
              <p className="text-sm text-gray-600">
                Nutrient relationships (e.g., protein vs carbs).
              </p>
              <div className="w-full h-48">
                <ReactECharts option={buildScatterOption()} style={{ margin: '-10px' ,height: '130%', width: '100%' }} />
              </div>
            </div>

            <div className="bg-white p-4 shadow-lg rounded-lg">
              <h3 className="font-semibold">Heatmap</h3>
              <p className="text-sm text-gray-600">Nutrient correlations.</p>
              <div className="w-full h-48">
                <ReactECharts option={buildHeatmapOption()} style={{ height: '130%', width: '100%' }} />
              </div>
            </div>

            <div className="bg-white p-4 shadow-lg rounded-lg">
              <h3 className="font-semibold">Pie Chart</h3>
              <p className="text-sm text-gray-600">
                Recipe distribution by diet type.
              </p>
              <div className="w-full h-48">
                <ReactECharts option={buildPieOption()} style={{ height: '110%', width: '100%' }} />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            Filters and Data Interaction
          </h2>
          <div className="bg-white p-4 shadow-lg rounded-lg w-full">
            <div className="flex flex-col flex-wrap gap-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search Recipies"
                className="p-2 border rounded w-full sm:w-auto"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* Filter */}
              <select
                value={dietType}
                onChange={(e) => setDietType(e.target.value)}
                className="p-2 w-fit border rounded sm:w-auto"
              >
                <option value="all">All Diet Types</option>
                <option value="vegan">Vegan</option>
                <option value="keto">Keto</option>
                <option value="paleo">Paleo</option>
                <option value="mediterranean">Mediterranean</option>
                <option value="dash">Dash</option>
              </select>
              <div className="min-h-20 max-h-50 overflow-auto pagination">
                {searchResults.length === 0 || searchTerm === "" ? (
                  <p className="text-gray-600 text-center py-10">
                    No results found.
                  </p>
                ) : (
                  searchResults.map((item, index) => (
                    <div key={index} className="py-2 flex">
                      <input
                        type="checkbox"
                        value={index}
                        name="recipie"
                        className="mr-2 mt-1"
                        checked={selectedItems.includes(index)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems((prev) =>
                              prev.includes(index) ? prev : [...prev, index]
                            );
                          } else {
                            setSelectedItems((prev) => prev.filter((i) => i !== index));
                          }
                        }}
                      />
                      <div>
                        <h3 className="">
                          {item.Recipe_name || "Unnamed Recipe"}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Diet Type:{" "}
                          {capitalizeFirstLetter(item.Diet_type) || "N/A"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">API Data Interaction</h2>
          <div className="bg-white p-4 shadow-lg rounded-lg w-full flex flex-wrap gap-4">
            <button
              className={`py-2 px-4 rounded text-white ${showNutrition ? 'bg-blue-700' : 'bg-blue-600'}`}
              onClick={() => {
                if (!showNutrition) {
                  getNutritionalInsights();
                }
                setShowNutrition((s) => !s);
              }}
            >
              {showNutrition ? 'Hide Nutritional Insights' : 'Show Nutritional Insights'}
            </button>
            <button className="bg-green-600 text-white py-2 px-4 rounded" onClick={getRandomRecipes}>
              Get Recipes
            </button>
          </div>
        </section>
        {/* Selected nutrition display */}
        {showNutrition && (
          <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Selected Nutrition</h2>
          <div className="bg-white p-4 shadow-lg rounded-lg w-full">
            {selectedItems.length === 0 ? (
              <p className="text-gray-600">No items selected.</p>
            ) : selectedNutrition.length === 0 ? (
              <p className="text-gray-600">Click "Get Nutritional Insights" to show selected items' nutrition.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedNutrition.map((s, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <h3 className="font-semibold mb-2">{s.name}</h3>
                    {Object.keys(s.nutrients).length === 0 ? (
                      <p className="text-sm text-gray-600">No nutritional keys detected; showing raw data:</p>
                    ) : (
                      <table className="w-full text-sm mb-2">
                        <tbody>
                          {Object.entries(s.nutrients).map(([k, v]) => (
                            <tr key={k}>
                              <td className="font-medium pr-4">{k}</td>
                              <td>{String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <details>
                      <summary className="text-sm text-gray-600">Raw item</summary>
                      <pre className="text-xs max-h-40 overflow-auto mt-2">{JSON.stringify(s.raw, null, 2)}</pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
          </section>
        )}

        {/* Random recipes display */}
        {randomRecipes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Suggested Recipes</h2>
            <div className="bg-white p-4 shadow-lg rounded-lg w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {randomRecipes.map((s, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <h3 className="font-semibold mb-2">{s.name}</h3>
                    <table className="w-full text-sm mb-2">
                      <tbody>
                        {Object.entries(s.nutrients).map(([k, v]) => (
                          <tr key={k}>
                            <td className="font-medium pr-4">{k}</td>
                            <td>{String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <details>
                      <summary className="text-sm text-gray-600">Raw item</summary>
                      <pre className="text-xs max-h-40 overflow-auto mt-2">{JSON.stringify(s.raw, null, 2)}</pre>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        {/* Ignored */}
        {/* <section>
          <h2 className="text-2xl font-semibold mb-4">Pagination</h2>
          <div className="flex justify-center gap-2 mt-4">
            <button className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400">
              Previous
            </button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded">
              1
            </button>
            <button className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400">
              2
            </button>
            <button className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400">
              Next
            </button>
          </div>
        </section> */}
      </div>

      {/* Footer */}
      <div className="bg-blue-600 fixed bottom-0 left-0 w-full p-4 text-white text-center">
        <p>&copy; 2025 Nutritional Insights. All Rights Reserved.</p>
      </div>
    </div>
  );
}
