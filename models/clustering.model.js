import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';

const provinsiList = getProvinsiList();

const clusterSummaryItemSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['baik', 'sedang', 'kurang', 'buruk'],
    required: true
  },
  rata_rata_skor_standar: {
    type: Number,
    required: true
  }
});

const clusterSummarySchema = new mongoose.Schema({
  indikator_umum_ketahanan_pangan: {
    type: clusterSummaryItemSchema,
    required: true
  },
  ketersediaan: {
    type: clusterSummaryItemSchema,
    required: true
  },
  aksesibilitas: {
    type: clusterSummaryItemSchema,
    required: true
  },
  pemanfaatan: {
    type: clusterSummaryItemSchema,
    required: true
  },
  stabilitas: {
    type: clusterSummaryItemSchema,
    required: true
  }
});

const clusteringSchema = new mongoose.Schema({
  tahun: {
    type: Number,
    required: true,
    min: 2000,
    max: 2045
  },
  cluster_id: {
    type: Number,
    required: true,
    min: -1  // Allow -1 for outliers
  },
  cluster_group: {
    type: String,
    required: true
  },
  provinceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Province'
  },
  kodeProvinsi: {
    type: String,
    required: true
  },
  namaProvinsi: {
    type: String,
    required: true
  },
  cluster_summary: {
    type: clusterSummarySchema,
    required: true
  },
  // Virtual field for outlier detection
  isOutlier: {
    type: Boolean,
    default: function() {
      return this.cluster_id === -1;
    }
  },
  // Additional metadata
  clusterLabel: {
    type: String,
    default: function() {
      if (this.cluster_id === -1) {
        return 'Outlier';
      }
      return `Cluster ${this.cluster_id}`;
    }
  }
}, {
  timestamps: true,
  collection: 'clustering_data',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for getting cluster status
clusteringSchema.virtual('clusterStatus').get(function() {
  if (this.cluster_id === -1) {
    return {
      type: 'outlier',
      label: 'Outlier',
      description: 'Data point yang tidak masuk dalam cluster manapun'
    };
  }
  
  return {
    type: 'cluster',
    label: `Cluster ${this.cluster_id}`,
    description: `Provinsi termasuk dalam cluster ${this.cluster_id}`
  };
});

// Pre-save middleware to set outlier status and label
clusteringSchema.pre('save', function(next) {
  this.isOutlier = this.cluster_id === -1;
  this.clusterLabel = this.cluster_id === -1 ? 'Outlier' : `Cluster ${this.cluster_id}`;
  next();
});

// Indexes for better query performance
clusteringSchema.index({ tahun: 1, cluster_id: 1 });
clusteringSchema.index({ kodeProvinsi: 1, tahun: 1 });
clusteringSchema.index({ provinceId: 1 });
clusteringSchema.index({ isOutlier: 1 });

// Compound index for cluster analysis queries
clusteringSchema.index({ 
  tahun: 1, 
  cluster_id: 1, 
  cluster_group: 1 
});

const Clustering = mongoose.model('Clustering', clusteringSchema);

export default Clustering;

